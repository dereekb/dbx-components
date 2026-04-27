/**
 * `scan-filters` subcommand entry point.
 *
 * Parses argv, runs {@link buildFiltersManifest}, and either writes the
 * resulting JSON to disk or compares it to the existing on-disk manifest
 * (`--check` mode) and exits non-zero on drift.
 *
 * Mirrors the structure of the other scanner CLIs so the family of scanners
 * shares a familiar argv vocabulary (`--project`, `--check`, `--out`, `--help`).
 */

import { readFile as nodeReadFile, writeFile as nodeWriteFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildFiltersManifest, serializeFilterManifest, type BuildFiltersGlobber, type BuildFiltersManifestOutcome } from './filters-build-manifest.js';
import { type FilterExtractWarning } from './filters-extract.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type FiltersScanCliReadFile = (absolutePath: string) => Promise<string>;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type FiltersScanCliWriteFile = (absolutePath: string, data: string) => Promise<void>;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type FiltersScanCliLogger = (message: string) => void;

/**
 * Input to {@link runFiltersScanCli}.
 */
export interface RunFiltersScanCliInput {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly generator: string;
  readonly readFile?: FiltersScanCliReadFile;
  readonly writeFile?: FiltersScanCliWriteFile;
  readonly globber?: BuildFiltersGlobber;
  readonly now?: () => Date;
  readonly log?: FiltersScanCliLogger;
  readonly errorLog?: FiltersScanCliLogger;
}

/**
 * Result of one CLI invocation.
 */
export interface RunFiltersScanCliResult {
  readonly exitCode: number;
}

const USAGE = [
  'Usage: dbx-components-mcp scan-filters --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a FilterManifest by walking <dir> for classes and interfaces tagged with @dbxFilter.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

const DEFAULT_READ_FILE: FiltersScanCliReadFile = (path) => nodeReadFile(path, 'utf-8');
const DEFAULT_WRITE_FILE: FiltersScanCliWriteFile = (path, data) => nodeWriteFile(path, data, 'utf-8');

// MARK: Entry point
/**
 * Runs one invocation of `scan-filters`. The function never throws on user
 * errors — every failure path returns a structured exit code so callers can
 * wire this into `process.exit` without try/catch.
 *
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runFiltersScanCli(input: RunFiltersScanCliInput): Promise<RunFiltersScanCliResult> {
  const { argv, cwd, generator, readFile = DEFAULT_READ_FILE, writeFile = DEFAULT_WRITE_FILE, globber, now, log = console.log, errorLog = console.error } = input;

  let result: RunFiltersScanCliResult;
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
    const outcome = await buildFiltersManifest({ projectRoot, generator, readFile, globber, now });
    result = await handleOutcome({ outcome, args, projectArg: args.project, readFile, writeFile, log, errorLog });
  }

  return result;
}

// MARK: argv parsing
type ParsedArgs = { readonly kind: 'parsed'; readonly project: string | undefined; readonly check: boolean; readonly out: string | undefined; readonly help: boolean } | { readonly kind: 'parse-error'; readonly message: string };

function parseArgs(argv: readonly string[]): ParsedArgs {
  let project: string | undefined;
  let out: string | undefined;
  let check = false;
  let help = false;
  let error: string | undefined;
  let index = 0;

  while (index < argv.length && error === undefined) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      help = true;
      index += 1;
    } else if (token === '--check') {
      check = true;
      index += 1;
    } else if (token === '--project') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        error = '--project requires a value';
      } else {
        project = value;
        index += 2;
      }
    } else if (token.startsWith('--project=')) {
      project = token.slice('--project='.length);
      index += 1;
    } else if (token === '--out') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        error = '--out requires a value';
      } else {
        out = value;
        index += 2;
      }
    } else if (token.startsWith('--out=')) {
      out = token.slice('--out='.length);
      index += 1;
    } else {
      error = `Unknown argument: ${token}`;
    }
  }

  let result: ParsedArgs;
  if (error === undefined) {
    result = { kind: 'parsed', project, check, out, help };
  } else {
    result = { kind: 'parse-error', message: error };
  }
  return result;
}

// MARK: Outcome handling
interface HandleOutcomeInput {
  readonly outcome: BuildFiltersManifestOutcome;
  readonly args: Extract<ParsedArgs, { kind: 'parsed' }>;
  readonly projectArg: string;
  readonly readFile: FiltersScanCliReadFile;
  readonly writeFile: FiltersScanCliWriteFile;
  readonly log: FiltersScanCliLogger;
  readonly errorLog: FiltersScanCliLogger;
}

async function handleOutcome(input: HandleOutcomeInput): Promise<RunFiltersScanCliResult> {
  const { outcome, args, projectArg, readFile, writeFile, log, errorLog } = input;

  let result: RunFiltersScanCliResult;
  if (outcome.kind === 'success') {
    const finalOutPath = args.out === undefined ? outcome.outPath : resolve(outcome.outPath, '..', args.out);
    const serialized = serializeFilterManifest(outcome.manifest);
    if (args.check) {
      let existing: string | null = null;
      try {
        existing = await readFile(finalOutPath);
      } catch {
        existing = null;
      }
      if (existing === serialized) {
        log(`Manifest fresh: ${finalOutPath} (${outcome.manifest.entries.length} entries, ${outcome.scannedFileCount} files scanned)`);
        result = { exitCode: 0 };
      } else {
        errorLog(`Manifest is stale at ${finalOutPath}.`);
        errorLog('Regenerate by running:');
        errorLog(`  dbx-components-mcp scan-filters --project ${projectArg}`);
        result = { exitCode: 1 };
      }
    } else {
      await writeFile(finalOutPath, serialized);
      log(`Wrote manifest: ${finalOutPath} (${outcome.manifest.entries.length} entries, ${outcome.scannedFileCount} files scanned)`);
      for (const warning of outcome.extractWarnings) {
        errorLog(`extract-warning: ${formatExtractWarning(warning)}`);
      }
      result = { exitCode: 0 };
    }
  } else if (outcome.kind === 'no-config') {
    errorLog(`Error: no scan config at ${outcome.configPath}`);
    errorLog('Create a dbx-mcp.scan.json file in the project root with a filters section.');
    result = { exitCode: 1 };
  } else if (outcome.kind === 'invalid-scan-config') {
    errorLog(`Error: invalid scan config at ${outcome.configPath}`);
    errorLog(outcome.error);
    result = { exitCode: 1 };
  } else if (outcome.kind === 'no-package') {
    errorLog(`Error: no package.json at ${outcome.packagePath}`);
    result = { exitCode: 1 };
  } else if (outcome.kind === 'invalid-package') {
    errorLog(`Error: invalid package.json at ${outcome.packagePath}`);
    errorLog(outcome.error);
    result = { exitCode: 1 };
  } else {
    errorLog('Error: generated manifest failed schema validation');
    errorLog(outcome.error);
    result = { exitCode: 1 };
  }
  return result;
}

function formatExtractWarning(warning: FilterExtractWarning): string {
  let result: string;
  switch (warning.kind) {
    case 'missing-required-tag':
      result = `${warning.className} (${warning.filePath}:${warning.line}) missing @${warning.tag}`;
      break;
    case 'directive-missing-decorator':
      result = `${warning.className} (${warning.filePath}:${warning.line}) missing @Directive() decorator`;
      break;
  }
  return result;
}
