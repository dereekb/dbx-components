/**
 * `scan-semantic-types` subcommand entry point.
 *
 * Parses argv, runs {@link buildManifest}, and either writes the
 * resulting JSON to disk or compares it to the existing on-disk
 * manifest (`--check` mode) and exits non-zero on drift.
 *
 * The CLI is exposed via the `dbx-components-mcp` binary's argv
 * dispatcher in `bin/dbx-components-mcp.ts`. All I/O is injectable so
 * unit tests can drive the entire control flow without disk access.
 */

import type { Maybe } from '@dereekb/util';
import { readFile as nodeReadFile, writeFile as nodeWriteFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildManifest, serializeManifest, type BuildManifestGlobber, type BuildManifestOutcome } from './build-manifest.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type ScanCliReadFile = (absolutePath: string) => Promise<string>;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type ScanCliWriteFile = (absolutePath: string, data: string) => Promise<void>;

/**
 * Console-shaped sink for stdout and stderr lines. Tests inject a
 * collecting implementation.
 */
export type ScanCliLogger = (message: string) => void;

/**
 * Input to {@link runScanCli}. `argv` is `process.argv` after the
 * subcommand token (so `['--project', 'apps/hellosubs']`). When
 * `readFile` / `writeFile` / `globber` are supplied they are also
 * forwarded into {@link buildManifest} so unit tests can drive the
 * full pipeline without disk access.
 */
export interface RunScanCliInput {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly generator: string;
  readonly readFile?: ScanCliReadFile;
  readonly writeFile?: ScanCliWriteFile;
  readonly globber?: BuildManifestGlobber;
  readonly now?: () => Date;
  readonly log?: ScanCliLogger;
  readonly errorLog?: ScanCliLogger;
}

/**
 * Result of one CLI invocation. The returned `exitCode` is what the
 * `bin/` shim should pass to `process.exit`.
 */
export interface RunScanCliResult {
  readonly exitCode: number;
}

const USAGE = [
  'Usage: dbx-components-mcp scan-semantic-types --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a SemanticTypeManifest by walking <dir> for types tagged with @semanticType.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

const DEFAULT_READ_FILE: ScanCliReadFile = (path) => nodeReadFile(path, 'utf-8');
const DEFAULT_WRITE_FILE: ScanCliWriteFile = (path, data) => nodeWriteFile(path, data, 'utf-8');

// MARK: Entry point
/**
 * Runs one invocation of `scan-semantic-types`. The function never
 * throws on user errors — every failure path returns a structured
 * exit code so callers can wire this into `process.exit` without
 * try/catch.
 *
 * @param input - Argv plus injectable I/O hooks.
 * @returns The CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runScanCli(input: RunScanCliInput): Promise<RunScanCliResult> {
  const { argv, cwd, generator, readFile = DEFAULT_READ_FILE, writeFile = DEFAULT_WRITE_FILE, globber, now, log = console.log, errorLog = console.error } = input;

  let result: RunScanCliResult;
  const args = parseArgs(argv);

  if (args.kind === 'parse-error') {
    errorLog(`Error: ${args.message}`);
    errorLog(USAGE);
    result = { exitCode: 2 };
  } else if (args.help) {
    log(USAGE);
    result = { exitCode: 0 };
  } else if (args.project === undefined) {
    errorLog('Error: --project is required');
    errorLog(USAGE);
    result = { exitCode: 2 };
  } else {
    const projectRoot = resolve(cwd, args.project);
    const outcome = await buildManifest({ projectRoot, generator, readFile, globber, now });
    result = await handleOutcome({ outcome, args, projectArg: args.project, readFile, writeFile, log, errorLog });
  }

  return result;
}

// MARK: argv parsing
type ParsedArgs = { readonly kind: 'parsed'; readonly project: string | undefined; readonly check: boolean; readonly out: string | undefined; readonly help: boolean } | { readonly kind: 'parse-error'; readonly message: string };

interface MutableParseState {
  project: string | undefined;
  out: string | undefined;
  check: boolean;
  help: boolean;
  error: string | undefined;
  index: number;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const state: MutableParseState = {
    project: undefined,
    out: undefined,
    check: false,
    help: false,
    error: undefined,
    index: 0
  };

  while (state.index < argv.length && state.error === undefined) {
    consumeArgsToken(state, argv);
  }

  let result: ParsedArgs;
  if (state.error === undefined) {
    result = { kind: 'parsed', project: state.project, check: state.check, out: state.out, help: state.help };
  } else {
    result = { kind: 'parse-error', message: state.error };
  }
  return result;
}

function consumeArgsToken(state: MutableParseState, argv: readonly string[]): void {
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
interface HandleOutcomeInput {
  readonly outcome: BuildManifestOutcome;
  readonly args: Extract<ParsedArgs, { kind: 'parsed' }>;
  readonly projectArg: string;
  readonly readFile: ScanCliReadFile;
  readonly writeFile: ScanCliWriteFile;
  readonly log: ScanCliLogger;
  readonly errorLog: ScanCliLogger;
}

async function handleSuccessOutcome(input: HandleOutcomeInput & { readonly outcome: Extract<BuildManifestOutcome, { kind: 'success' }> }): Promise<RunScanCliResult> {
  const { outcome, args, projectArg, readFile, writeFile, log, errorLog } = input;
  const finalOutPath = args.out === undefined ? outcome.outPath : resolve(outcome.outPath, '..', args.out);
  const serialized = serializeManifest(outcome.manifest);

  let result: RunScanCliResult;
  if (args.check) {
    result = await checkManifest({ finalOutPath, serialized, outcome, projectArg, readFile, log, errorLog });
  } else {
    await writeFile(finalOutPath, serialized);
    log(`Wrote manifest: ${finalOutPath} (${outcome.manifest.entries.length} entries, ${outcome.scannedFileCount} files scanned)`);
    result = { exitCode: 0 };
  }
  return result;
}

async function checkManifest(input: { readonly finalOutPath: string; readonly serialized: string; readonly outcome: Extract<BuildManifestOutcome, { kind: 'success' }>; readonly projectArg: string; readonly readFile: ScanCliReadFile; readonly log: ScanCliLogger; readonly errorLog: ScanCliLogger }): Promise<RunScanCliResult> {
  const { finalOutPath, serialized, outcome, projectArg, readFile, log, errorLog } = input;
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
    errorLog(`  dbx-components-mcp scan-semantic-types --project ${projectArg}`);
    result = { exitCode: 1 };
  }
  return result;
}

function handleErrorOutcome(outcome: Exclude<BuildManifestOutcome, { kind: 'success' }>, errorLog: ScanCliLogger): RunScanCliResult {
  if (outcome.kind === 'no-config') {
    errorLog(`Error: no scan config at ${outcome.configPath}`);
    errorLog('Create a dbx-mcp.scan.json file in the project root.');
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

async function handleOutcome(input: HandleOutcomeInput): Promise<RunScanCliResult> {
  const { outcome, errorLog } = input;
  let result: RunScanCliResult;
  if (outcome.kind === 'success') {
    result = await handleSuccessOutcome({ ...input, outcome });
  } else {
    result = handleErrorOutcome(outcome, errorLog);
  }
  return result;
}
