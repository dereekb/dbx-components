import yargs, { type Argv, type CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createAuthCommand } from '../auth/auth.command.factory';
import { callPassthroughCommand } from '../api/call.passthrough.command';
import { createDoctorCommand, type DoctorCheck } from '../doctor/doctor.command.factory';
import { createEnvCommand } from '../env/env.command.factory';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { createOutputMiddleware } from '../middleware/output.middleware';
import { outputError } from '../util/output';

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
   */
  readonly apiCommands?: CommandModule[];
  /**
   * Extra checks appended to the doctor's default check list.
   */
  readonly doctorChecks?: DoctorCheck[];
  /**
   * Argv to parse. Defaults to `hideBin(process.argv)`.
   */
  readonly argv?: string[];
  /**
   * Disable the built-in `call` passthrough — useful when an app prefers to expose only typed wrappers.
   */
  readonly disableCallPassthrough?: boolean;
}

/**
 * Top-level CLI builder.
 *
 * Wires the standard yargs setup (global flags, auth/output middleware, the built-in `auth`, `env`,
 * `doctor`, and `call` commands), and returns a yargs parser ready to be `.parse()`-d.
 *
 * App CLIs become a thin `index.ts` that imports `createCli`, registers any app-specific commands,
 * and calls `.parse()`.
 */
export function createCli(input: CreateCliInput): Argv {
  const cliName = input.cliName;
  const builtInConfigCommands: CommandModule[] = [createAuthCommand({ cliName }), createEnvCommand({ cliName }), createDoctorCommand({ cliName, checks: input.doctorChecks })];
  const allConfigCommands = [...builtInConfigCommands, ...(input.configCommands ?? [])];
  const builtInApiCommands: CommandModule[] = input.disableCallPassthrough ? [] : [callPassthroughCommand];
  const allApiCommands = [...builtInApiCommands, ...(input.apiCommands ?? [])];

  const skipCommandNames = new Set(allConfigCommands.map((c) => commandName(c)));

  return yargs(input.argv ?? hideBin(process.argv))
    .scriptName(cliName)
    .usage('$0 <command> [options]')
    .option('verbose', { alias: 'v', type: 'boolean', default: false, global: true, describe: 'Verbose output' })
    .option('env', { type: 'string', global: true, describe: 'Named env to target (overrides activeEnv and *_ENV var)' })
    .option('dump-dir', { type: 'string', global: true, describe: 'Directory to save full responses as JSON files' })
    .option('pick', { type: 'string', global: true, describe: 'Comma-separated top-level fields to include in output' })
    .option('set-dump-dir', { type: 'string', global: true, describe: 'Save dump-dir for this command and apply now' })
    .option('set-pick', { type: 'string', global: true, describe: 'Save pick for this command and apply now' })
    .option('pick-all', { type: 'boolean', global: true, describe: 'Ignore configured pick filters' })
    .middleware([createAuthMiddleware({ cliName, skipCommands: skipCommandNames }), createOutputMiddleware({ cliName, skipCommands: skipCommandNames })], true)
    .command(allConfigCommands)
    .command(allApiCommands)
    .demandCommand(1, 'Please specify a command. Use --help for available commands.')
    .strict()
    .fail(false)
    .help()
    .alias('help', 'h')
    .version(false)
    .wrap(Math.min(120, process.stdout.columns || 80));
}

/**
 * Convenience helper for app `index.ts` entrypoints — wraps `createCli().parse()` in a try/catch
 * that emits a structured error envelope and exits 1 on uncaught failures.
 */
export async function runCli(input: CreateCliInput): Promise<void> {
  try {
    await createCli(input).parse();
  } catch (e) {
    outputError(e);
    process.exit(1);
  }
}

function commandName(cmd: CommandModule): string {
  const raw = cmd.command;

  if (typeof raw === 'string') {
    return raw.split(' ')[0];
  }

  if (Array.isArray(raw) && raw.length > 0) {
    return raw[0].split(' ')[0];
  }

  return '';
}
