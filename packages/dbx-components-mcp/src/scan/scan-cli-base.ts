/**
 * Generic core for the per-domain scan CLIs (actions, filters, forge-fields,
 * pipes, ui-components).
 *
 * Each domain CLI (`actions-cli.ts`, etc.) is a thin wrapper that supplies a
 * subcommand label, USAGE block, build-manifest function, manifest
 * serializer, and a domain-specific `formatExtractWarning`. The argv parser,
 * outcome dispatcher, drift check, and exit-code mapping live here so the
 * five domains do not duplicate ~100 lines of identical procedural code each.
 *
 * The semantic-types CLI (`cli.ts`) is intentionally not migrated to this
 * base: it pre-dates the family pattern and would require touching its
 * downstream wiring without removing meaningful additional duplication.
 */

import type { Maybe } from '@dereekb/util';
import { readFile as nodeReadFile, writeFile as nodeWriteFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type ScanCliBaseReadFile = (absolutePath: string) => Promise<string>;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type ScanCliBaseWriteFile = (absolutePath: string, data: string) => Promise<void>;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type ScanCliBaseLogger = (message: string) => void;

/**
 * Result of one CLI invocation.
 */
export interface RunScanCliResult {
  readonly exitCode: number;
}

/**
 * Minimum manifest shape the base CLI needs — `entries.length` is reported in
 * the success log.
 */
export interface ScanCliManifestLike {
  readonly entries: readonly unknown[];
}

/**
 * Success branch of a `buildManifest` outcome.
 */
export interface ScanCliBuildSuccess<TManifest extends ScanCliManifestLike, TWarning> {
  readonly kind: 'success';
  readonly manifest: TManifest;
  readonly outPath: string;
  readonly scannedFileCount: number;
  readonly extractWarnings: readonly TWarning[];
}

/**
 * Failure branches of a `buildManifest` outcome — shape shared verbatim by
 * every domain build-manifest module today.
 */
export type ScanCliBuildFailure = { readonly kind: 'no-config'; readonly configPath: string } | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string } | { readonly kind: 'no-package'; readonly packagePath: string } | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string } | { readonly kind: 'invalid-manifest'; readonly error: string };

/**
 * Discriminated union returned by a domain's `buildManifest` function.
 */
export type ScanCliBuildOutcome<TManifest extends ScanCliManifestLike, TWarning> = ScanCliBuildSuccess<TManifest, TWarning> | ScanCliBuildFailure;

/**
 * Input passed to the domain's `buildManifest` function. Each domain accepts
 * a structural superset of this (e.g. its own globber type), so the base
 * threads `TGlobber` through as a generic parameter.
 */
export interface ScanCliBuildInput<TGlobber> {
  readonly projectRoot: string;
  readonly generator: string;
  readonly readFile: ScanCliBaseReadFile;
  readonly globber?: TGlobber;
  readonly now?: () => Date;
}

/**
 * Per-domain configuration for {@link runScanCliBase}.
 */
export interface ScanCliConfig<TManifest extends ScanCliManifestLike, TWarning, TGlobber> {
  /**
   * Subcommand label printed in the regenerate hint, e.g. `scan-actions`.
   */
  readonly subcommand: string;
  /**
   * Pre-rendered USAGE block printed for `--help` and on parse errors.
   */
  readonly usage: string;
  /**
   * Suffix appended to the no-config error guidance — e.g. `with an actions
   * section.` The full message becomes
   * `Create a dbx-mcp.scan.json file in the project root <hint>`.
   */
  readonly configSectionHint: string;
  /**
   * Domain build-manifest entry point.
   */
  readonly buildManifest: (input: ScanCliBuildInput<TGlobber>) => Promise<ScanCliBuildOutcome<TManifest, TWarning>>;
  /**
   * Serializes the validated manifest to the exact bytes written to disk
   * (including trailing newline). Tests rely on byte-equality for `--check`.
   */
  readonly serialize: (manifest: TManifest) => string;
  /**
   * Formats one extract warning for the `extract-warning: ...` log line.
   */
  readonly formatExtractWarning: (warning: TWarning) => string;
}

/**
 * Input to {@link runScanCliBase}.
 */
export interface RunScanCliBaseInput<TGlobber> {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly generator: string;
  readonly readFile?: ScanCliBaseReadFile;
  readonly writeFile?: ScanCliBaseWriteFile;
  readonly globber?: TGlobber;
  readonly now?: () => Date;
  readonly log?: ScanCliBaseLogger;
  readonly errorLog?: ScanCliBaseLogger;
}

const DEFAULT_READ_FILE: ScanCliBaseReadFile = (path) => nodeReadFile(path, 'utf-8');
const DEFAULT_WRITE_FILE: ScanCliBaseWriteFile = (path, data) => nodeWriteFile(path, data, 'utf-8');

// MARK: Entry point
/**
 * Runs one invocation of a scan subcommand. The function never throws on
 * user errors — every failure path returns a structured exit code so callers
 * can wire this into `process.exit` without try/catch.
 *
 * @param input - Argv plus injectable I/O hooks.
 * @param config - Per-domain wiring (subcommand label, usage, build, serialize, warning formatter)
 * @returns The CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runScanCliBase<TManifest extends ScanCliManifestLike, TWarning, TGlobber>(input: RunScanCliBaseInput<TGlobber>, config: ScanCliConfig<TManifest, TWarning, TGlobber>): Promise<RunScanCliResult> {
  const { argv, cwd, generator, readFile = DEFAULT_READ_FILE, writeFile = DEFAULT_WRITE_FILE, globber, now, log = console.log, errorLog = console.error } = input;

  const args = parseScanArgs(argv);
  const validation = validateParsedScanArgs({ args, config, log, errorLog });
  if (validation.kind === 'done') {
    return validation.result;
  }

  const projectRoot = resolve(cwd, validation.project);
  const outcome = await config.buildManifest({ projectRoot, generator, readFile, globber, now });
  return handleOutcome({ outcome, args: validation.args, projectArg: validation.project, readFile, writeFile, log, errorLog, config });
}

type ValidateParsedScanArgsResult = { readonly kind: 'done'; readonly result: RunScanCliResult } | { readonly kind: 'proceed'; readonly args: Extract<ParsedScanArgs, { kind: 'parsed' }>; readonly project: string };

interface ValidateParsedScanArgsInput<TManifest extends ScanCliManifestLike, TWarning, TGlobber> {
  readonly args: ParsedScanArgs;
  readonly config: ScanCliConfig<TManifest, TWarning, TGlobber>;
  readonly log: ScanCliBaseLogger;
  readonly errorLog: ScanCliBaseLogger;
}

function validateParsedScanArgs<TManifest extends ScanCliManifestLike, TWarning, TGlobber>(input: ValidateParsedScanArgsInput<TManifest, TWarning, TGlobber>): ValidateParsedScanArgsResult {
  const { args, config, log, errorLog } = input;
  if (args.kind === 'parse-error') {
    errorLog(`Error: ${args.message}`);
    errorLog(config.usage);
    return { kind: 'done', result: { exitCode: 2 } };
  }
  if (args.help) {
    log(config.usage);
    return { kind: 'done', result: { exitCode: 0 } };
  }
  if (args.project === undefined) {
    errorLog('Error: --project is required');
    errorLog(config.usage);
    return { kind: 'done', result: { exitCode: 2 } };
  }
  return { kind: 'proceed', args, project: args.project };
}

// MARK: argv parsing
type ParsedScanArgs = { readonly kind: 'parsed'; readonly project: string | undefined; readonly check: boolean; readonly out: string | undefined; readonly help: boolean } | { readonly kind: 'parse-error'; readonly message: string };

interface MutableParseState {
  project: string | undefined;
  out: string | undefined;
  check: boolean;
  help: boolean;
  error: string | undefined;
  index: number;
}

/**
 * Parses the shared scan CLI argv vocabulary (`--project`, `--check`,
 * `--out`, `--help`).
 *
 * @param argv - Argument tokens, excluding the node binary and script paths.
 * @returns Either the parsed flag bag or a `parse-error` describing the first malformed token.
 */
export function parseScanArgs(argv: readonly string[]): ParsedScanArgs {
  const state: MutableParseState = {
    project: undefined,
    out: undefined,
    check: false,
    help: false,
    error: undefined,
    index: 0
  };

  while (state.index < argv.length && state.error === undefined) {
    consumeScanToken(state, argv);
  }

  let result: ParsedScanArgs;
  if (state.error === undefined) {
    result = { kind: 'parsed', project: state.project, check: state.check, out: state.out, help: state.help };
  } else {
    result = { kind: 'parse-error', message: state.error };
  }
  return result;
}

function consumeScanToken(state: MutableParseState, argv: readonly string[]): void {
  const token = argv[state.index];
  if (token === '--help' || token === '-h') {
    state.help = true;
    state.index += 1;
  } else if (token === '--check') {
    state.check = true;
    state.index += 1;
  } else if (token === '--project') {
    consumeValueFlag({ state, argv, target: 'project', flagName: '--project' });
  } else if (token.startsWith('--project=')) {
    state.project = token.slice('--project='.length);
    state.index += 1;
  } else if (token === '--out') {
    consumeValueFlag({ state, argv, target: 'out', flagName: '--out' });
  } else if (token.startsWith('--out=')) {
    state.out = token.slice('--out='.length);
    state.index += 1;
  } else {
    state.error = `Unknown argument: ${token}`;
  }
}

interface ConsumeValueFlagInput {
  readonly state: MutableParseState;
  readonly argv: readonly string[];
  readonly target: 'project' | 'out';
  readonly flagName: string;
}

function consumeValueFlag(input: ConsumeValueFlagInput): void {
  const { state, argv, target, flagName } = input;
  const value = argv[state.index + 1];
  if (value === undefined || value.startsWith('--')) {
    state.error = `${flagName} requires a value`;
    return;
  }
  state[target] = value;
  state.index += 2;
}

// MARK: Outcome handling
interface HandleOutcomeInput<TManifest extends ScanCliManifestLike, TWarning, TGlobber> {
  readonly outcome: ScanCliBuildOutcome<TManifest, TWarning>;
  readonly args: Extract<ParsedScanArgs, { kind: 'parsed' }>;
  readonly projectArg: string;
  readonly readFile: ScanCliBaseReadFile;
  readonly writeFile: ScanCliBaseWriteFile;
  readonly log: ScanCliBaseLogger;
  readonly errorLog: ScanCliBaseLogger;
  readonly config: ScanCliConfig<TManifest, TWarning, TGlobber>;
}

async function handleOutcome<TManifest extends ScanCliManifestLike, TWarning, TGlobber>(input: HandleOutcomeInput<TManifest, TWarning, TGlobber>): Promise<RunScanCliResult> {
  const { outcome } = input;
  let result: RunScanCliResult;
  if (outcome.kind === 'success') {
    result = await handleSuccess({ ...input, outcome });
  } else {
    result = handleFailure(outcome, input.errorLog, input.config);
  }
  return result;
}

interface HandleSuccessInput<TManifest extends ScanCliManifestLike, TWarning, TGlobber> extends HandleOutcomeInput<TManifest, TWarning, TGlobber> {
  readonly outcome: ScanCliBuildSuccess<TManifest, TWarning>;
}

async function handleSuccess<TManifest extends ScanCliManifestLike, TWarning, TGlobber>(input: HandleSuccessInput<TManifest, TWarning, TGlobber>): Promise<RunScanCliResult> {
  const { outcome, args, projectArg, readFile, writeFile, log, errorLog, config } = input;
  const finalOutPath = args.out === undefined ? outcome.outPath : resolve(outcome.outPath, '..', args.out);
  const serialized = config.serialize(outcome.manifest);
  let result: RunScanCliResult;
  if (args.check) {
    result = await runCheck({ finalOutPath, serialized, outcome, projectArg, readFile, log, errorLog, config });
  } else {
    await writeFile(finalOutPath, serialized);
    log(`Wrote manifest: ${finalOutPath} (${outcome.manifest.entries.length} entries, ${outcome.scannedFileCount} files scanned)`);
    for (const warning of outcome.extractWarnings) {
      errorLog(`extract-warning: ${config.formatExtractWarning(warning)}`);
    }
    result = { exitCode: 0 };
  }
  return result;
}

interface RunCheckInput<TManifest extends ScanCliManifestLike, TWarning, TGlobber> {
  readonly finalOutPath: string;
  readonly serialized: string;
  readonly outcome: ScanCliBuildSuccess<TManifest, TWarning>;
  readonly projectArg: string;
  readonly readFile: ScanCliBaseReadFile;
  readonly log: ScanCliBaseLogger;
  readonly errorLog: ScanCliBaseLogger;
  readonly config: ScanCliConfig<TManifest, TWarning, TGlobber>;
}

async function runCheck<TManifest extends ScanCliManifestLike, TWarning, TGlobber>(input: RunCheckInput<TManifest, TWarning, TGlobber>): Promise<RunScanCliResult> {
  const { finalOutPath, serialized, outcome, projectArg, readFile, log, errorLog, config } = input;
  let existing: Maybe<string>;
  try {
    existing = await readFile(finalOutPath);
  } catch {
    existing = null;
  }
  let result: RunScanCliResult;
  if (existing === serialized) {
    log(`Manifest fresh: ${finalOutPath} (${outcome.manifest.entries.length} entries, ${outcome.scannedFileCount} files scanned)`);
    result = { exitCode: 0 };
  } else {
    errorLog(`Manifest is stale at ${finalOutPath}.`);
    errorLog('Regenerate by running:');
    errorLog(`  dbx-components-mcp ${config.subcommand} --project ${projectArg}`);
    result = { exitCode: 1 };
  }
  return result;
}

function handleFailure<TManifest extends ScanCliManifestLike, TWarning, TGlobber>(outcome: ScanCliBuildFailure, errorLog: ScanCliBaseLogger, config: ScanCliConfig<TManifest, TWarning, TGlobber>): RunScanCliResult {
  if (outcome.kind === 'no-config') {
    errorLog(`Error: no scan config at ${outcome.configPath}`);
    errorLog(`Create a dbx-mcp.scan.json file in the project root ${config.configSectionHint}`);
  } else if (outcome.kind === 'invalid-scan-config') {
    errorLog(`Error: invalid scan config at ${outcome.configPath}`);
    errorLog(outcome.error);
  } else if (outcome.kind === 'no-package') {
    errorLog(`Error: no package.json at ${outcome.packagePath}`);
  } else if (outcome.kind === 'invalid-package') {
    errorLog(`Error: invalid package.json at ${outcome.packagePath}`);
    errorLog(outcome.error);
  } else {
    errorLog('Error: generated manifest failed schema validation');
    errorLog(outcome.error);
  }
  return { exitCode: 1 };
}
