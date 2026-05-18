import yargs, { type Argv, type CommandModule, type MiddlewareFunction } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { type ActionCommandSpec } from '../action/action.command.factory';
import { buildActionCommands } from '../action/build-action-commands';
import { createAuthCommand } from '../auth/auth.command.factory';
import { CALL_PASSTHROUGH_COMMAND } from '../api/call.passthrough.command';
import { GET_COMMAND } from '../api/get.command';
import { GET_MANY_COMMAND } from '../api/get-many.command';
import { type CliEnvDefault } from '../config/env';
import { type CliContext } from '../context/cli.context';
import { createDoctorCommand, type DoctorCheck } from '../doctor/doctor.command.factory';
import { createEnvCommand } from '../env/env.command.factory';
import { buildModelDecodeCommand } from '../manifest/build-model-decode-command';
import { buildModelInfoCommand } from '../manifest/build-model-info-command';
import { type CliModelManifest } from '../manifest/types';
import { createAuthMiddleware, createPassthroughAuthMiddleware } from '../middleware/auth.middleware';
import { createOutputMiddleware } from '../middleware/output.middleware';
import { createOutputCommand } from '../output/output.command.factory';
import { CLI_EXIT_CODE_HANDLER, outputError } from '../util/output';

/**
 * Names of the global options registered by {@link createCli} that are not
 * specific to a single manifest command's payload. Manifest commands hide
 * these from `--help` when the user passes `--data-help` so the help output
 * focuses on the schema sections.
 */
export const STANDARD_GLOBAL_OPTION_NAMES: readonly string[] = ['verbose', 'env', 'dump-dir', 'pick', 'set-dump-dir', 'set-pick', 'pick-all', 'pretty', 'timeout'];

export interface CreateCliInput {
  readonly cliName: string;
  /**
   * App-specific config/utility commands appended after the built-in `auth`, `env`, and `doctor` commands.
   *
   * Commands listed here bypass authentication.
   */
  readonly configCommands?: CommandModule[];
  /**
   * App-specific API commands appended after the built-in `call` passthrough.
   *
   * Commands listed here run after the auth middleware, so they have access to the {@link CliContext}.
   *
   * For manifest-driven typed model commands, pass the result of `buildManifestCommands(manifest)` —
   * it returns a single parent `model <model>` command so the top-level `--help` stays focused.
   */
  readonly apiCommands?: CommandModule[];
  /**
   * App-defined composite actions surfaced under `<cli> action <action>` (root) or
   * `<cli> action <model> <action>` (model-scoped).
   *
   * Each action runs after the auth middleware so the handler receives the live
   * {@link CliContext}. Use for high-leverage workflows that chain multiple
   * `callModel` / `getModel` / `getMultipleModels` calls in-process so the caller
   * does not pay one CLI round-trip per call.
   *
   * When omitted or empty, no `action` parent command is registered.
   */
  readonly actionCommands?: readonly ActionCommandSpec[];
  /**
   * Extra checks appended to the doctor's default check list.
   */
  readonly doctorChecks?: DoctorCheck[];
  /**
   * Built-in env presets shipped with the CLI. When the user runs commands against an env name
   * that matches one of {@link CliEnvDefault.names}, the default values are merged underneath the
   * stored config so users don't need to supply `apiBaseUrl`/`oidcIssuer` themselves.
   */
  readonly defaultEnvs?: readonly CliEnvDefault[];
  /**
   * Argv to parse. Defaults to `hideBin(process.argv)`.
   */
  readonly argv?: string[];
  /**
   * Disable the built-in `call` passthrough — useful when an app prefers to expose only typed wrappers.
   */
  readonly disableCallPassthrough?: boolean;
  /**
   * Disable the built-in `get <key>` / `get-many <key...>` commands.
   *
   * These hit the generic model-access endpoints (`GET /model/<modelType>/get` and
   * `POST /model/<modelType>/get`) which already exist on every {@link ModelApiController}.
   * Inferred-model resolution (`get jws/abc` → `modelType: jobWorkerSchedule`) requires the
   * generated {@link CreateCliInput.modelManifest} to be supplied; the explicit-model form
   * (`get <model> <key>`) works without it.
   */
  readonly disableModelGet?: boolean;
  /**
   * Generated Firestore model manifest used to drive the built-in `model-info` and `model-decode`
   * commands.
   *
   * Opt-in: when provided, top-level `model-info [model]` and `model-decode <key>` commands are
   * auto-wired into the built-in config commands so users can browse the model catalog and turn
   * raw Firestore keys (`sf/abc123`, `nb/abc/nbn/def`) into model + id info. When omitted, neither
   * command is registered. Apps that pass the manifest but want to suppress one or both commands
   * can set {@link disableModelInfo} and/or {@link disableModelDecode} to `true`.
   *
   * The manifest itself is also opt-in at build time. The `dbx-cli-firebase-api-manifest` generator
   * only emits `<NAMESPACE>_MODEL_MANIFEST` when invoked with `--emit-models`, so apps that never
   * enable this option won't bundle model metadata into their final binary.
   *
   * Note: this option only controls the inspection commands. Manifest-driven typed model commands
   * are still wired explicitly via {@link apiCommands} (see `buildManifestCommands`), and the
   * `--expand-keys` flag still requires passing the manifest to `buildManifestCommands`.
   */
  readonly modelManifest?: CliModelManifest;
  /**
   * Disable the built-in `model-info` command even when {@link modelManifest} is provided.
   *
   * Useful when an app wants the manifest available for `--expand-keys` (via `buildManifestCommands`)
   * but does not want to surface the `model-info` command itself.
   */
  readonly disableModelInfo?: boolean;
  /**
   * Disable the built-in `model-decode` command even when {@link modelManifest} is provided.
   *
   * Useful when an app wants the manifest available for `--expand-keys` or `model-info` but does
   * not want to surface the key-decode command itself.
   */
  readonly disableModelDecode?: boolean;
  /**
   * Test-only override that bypasses the auth middleware entirely and attaches the supplied
   * {@link CliContext} on every command invocation.
   *
   * When set, the default auth middleware (OIDC discovery, disk token load, refresh, `process.exit`
   * on failure) is replaced with a passthrough that just calls `setCliContext(testCliContext)`. The
   * output middleware still runs.
   *
   * @internal Intended for use from `@dereekb/dbx-cli/test`. Not for production wiring.
   */
  readonly testCliContext?: CliContext;
  /**
   * Optional version string. When set, yargs registers `--version` / `-V` on the root parser
   * returning this value. Defaults to omitted (no `--version` flag).
   *
   * Consumers typically pass their `package.json` version (read at build time, e.g. via a
   * bundler `define` or a generated module).
   */
  readonly version?: string;
  /**
   * Optional shell-completion command name. When set, yargs registers
   * `<cli> <completionCommandName>` (defaults to `completion`) that emits a bash/zsh script.
   * Pass `false` to disable.
   *
   * @default 'completion'
   */
  readonly completionCommandName?: string | false;
}

/**
 * Top-level CLI builder.
 *
 * Wires the standard yargs setup (global flags, auth/output middleware, the built-in `auth`, `env`,
 * `doctor`, and `call` commands), and returns a yargs parser ready to be `.parse()`-d.
 *
 * App CLIs become a thin `index.ts` that imports `createCli`, registers any app-specific commands,
 * and calls `.parse()`.
 *
 * @param input - Builder configuration.
 * @param input.cliName - The CLI's binary name (used as `scriptName`, env-var prefix, and config dir).
 * @param input.configCommands - App-specific config/utility commands appended after the built-ins; bypass auth.
 * @param input.apiCommands - App-specific API commands appended after the built-in `call` passthrough; run after auth middleware.
 * @param input.doctorChecks - Extra checks appended to the doctor's default check list.
 * @param input.defaultEnvs - Built-in env presets shipped with the CLI.
 * @param input.argv - Argv to parse. Defaults to `hideBin(process.argv)`.
 * @param input.disableCallPassthrough - When `true`, omits the built-in `call` passthrough.
 * @param input.modelManifest - Optional Firestore model manifest. When provided, auto-wires the
 *   built-in `model-info` command. Opt-in per app.
 * @param input.disableModelInfo - When `true`, suppresses the auto-wired `model-info` command even
 *   if {@link CreateCliInput.modelManifest} is provided.
 * @returns The configured yargs `Argv` ready to be `.parse()`-d.
 * @__NO_SIDE_EFFECTS__
 */
export function createCli(input: CreateCliInput): Argv {
  const cliName = input.cliName;
  const defaultEnvs = input.defaultEnvs;
  const builtInConfigCommands: CommandModule[] = [createAuthCommand({ cliName, defaultEnvs }), createEnvCommand({ cliName, defaultEnvs }), createDoctorCommand({ cliName, checks: input.doctorChecks, defaultEnvs }), createOutputCommand({ cliName })];

  if (input.modelManifest && input.disableModelInfo !== true) {
    builtInConfigCommands.push(buildModelInfoCommand(input.modelManifest));
  }

  if (input.modelManifest && input.disableModelDecode !== true) {
    builtInConfigCommands.push(buildModelDecodeCommand(input.modelManifest));
  }

  const allConfigCommands = [...builtInConfigCommands, ...(input.configCommands ?? [])];
  const builtInApiCommands: CommandModule[] = input.disableCallPassthrough ? [] : [CALL_PASSTHROUGH_COMMAND];

  if (input.disableModelGet !== true) {
    builtInApiCommands.push(GET_COMMAND, GET_MANY_COMMAND);
  }

  const actionCommands = buildActionCommands(input.actionCommands ?? []);
  const allApiCommands = [...builtInApiCommands, ...(input.apiCommands ?? []), ...actionCommands];

  const skipCommandNames = new Set(allConfigCommands.map((c) => commandName(c)));
  const authMiddleware: MiddlewareFunction = input.testCliContext ? createPassthroughAuthMiddleware({ cliContext: input.testCliContext }) : createAuthMiddleware({ cliName, skipCommands: skipCommandNames, defaultEnvs, modelManifest: input.modelManifest });

  let parser = yargs(input.argv ?? hideBin(process.argv))
    .scriptName(cliName)
    .usage('$0 <command> [options]')
    .option('verbose', { alias: 'v', type: 'boolean', default: false, global: true, describe: 'Emit stderr trace lines for HTTP calls' })
    .option('env', { type: 'string', global: true, describe: 'Named env to target (overrides activeEnv and *_ENV var)' })
    .option('dump-dir', { type: 'string', global: true, describe: 'Directory to save full responses as JSON files' })
    .option('pick', { type: 'string', global: true, describe: 'Comma-separated top-level fields to include in output' })
    .option('set-dump-dir', { type: 'string', global: true, describe: 'Save dump-dir for this command and apply now' })
    .option('set-pick', { type: 'string', global: true, describe: 'Save pick for this command and apply now' })
    .option('pick-all', { type: 'boolean', global: true, describe: 'Ignore configured pick filters' })
    .option('pretty', { type: 'boolean', default: false, global: true, describe: 'Pretty-print the stdout JSON envelope (2-space indent)' })
    .option('timeout', { type: 'number', global: true, describe: 'Per-HTTP-request timeout in seconds (aborts via AbortController)' })
    .option('data-help', { type: 'string', choices: ['jsonschema', 'arktype', 'both'] as const, global: true, describe: 'Schema format shown in --help for manifest commands (default: jsonschema)' })
    .option('all-help', { type: 'boolean', global: true, describe: 'Show the full options table in --help even when --data-help is in focus mode' })
    .middleware([authMiddleware, createOutputMiddleware({ cliName, skipCommands: skipCommandNames })], true)
    .command(allConfigCommands)
    .command(allApiCommands)
    .demandCommand(1, 'Please specify a command. Use --help for available commands.')
    .strict()
    .fail(false)
    .help()
    .alias('help', 'h')
    .wrap(Math.min(120, process.stdout.columns || 80));

  if (input.version == null) {
    parser = parser.version(false);
  } else {
    parser = parser.version(input.version);
  }

  if (input.completionCommandName !== false) {
    parser = parser.completion(input.completionCommandName ?? 'completion', 'Emit a shell-completion script for this CLI');
  }

  return parser;
}

/**
 * Convenience helper for app `index.ts` entrypoints — wraps `createCli().parse()` in a try/catch
 * that emits a structured error envelope and exits 1 on uncaught failures.
 *
 * @param input - The same builder configuration accepted by {@link createCli}.
 * @returns Resolves once the parser has finished. Rejects only when `process.exit` is stubbed (e.g. in tests).
 */
export async function runCli(input: CreateCliInput): Promise<void> {
  try {
    await createCli(input).parse();
  } catch (e) {
    outputError(e);
    process.exit(CLI_EXIT_CODE_HANDLER);
  }
}

function commandName(cmd: CommandModule): string {
  const raw = cmd.command;
  let result: string;

  if (typeof raw === 'string') {
    result = raw.split(' ')[0];
  } else if (Array.isArray(raw) && raw.length > 0) {
    result = raw[0].split(' ')[0];
  } else {
    result = '';
  }

  return result;
}
