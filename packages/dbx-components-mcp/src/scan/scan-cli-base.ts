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
 * @param input - argv plus injectable I/O hooks
 * @param config - per-domain wiring (subcommand label, usage, build, serialize, warning formatter)
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runScanCliBase<TManifest extends ScanCliManifestLike, TWarning, TGlobber>(input: RunScanCliBaseInput<TGlobber>, config: ScanCliConfig<TManifest, TWarning, TGlobber>): Promise<RunScanCliResult> {
  const { argv, cwd, generator, readFile = DEFAULT_READ_FILE, writeFile = DEFAULT_WRITE_FILE, globber, now, log = console.log, errorLog = console.error } = input;

  let result: RunScanCliResult;
  const args = parseScanArgs(argv);

  if (args.kind === 'parse-error') {
    errorLog(`Error: ${args.message}`);
    errorLog(config.usage);
    result = { exitCode: 2 };
  } else if (args.help) {
    log(config.usage);
    result = { exitCode: 0 };
  } else if (args.project === undefined) {
    errorLog('Error: --project is required');
    errorLog(config.usage);
    result = { exitCode: 2 };
  } else {
    const projectRoot = resolve(cwd, args.project);
    const outcome = await config.buildManifest({ projectRoot, generator, readFile, globber, now });
    result = await handleOutcome({ outcome, args, projectArg: args.project, readFile, writeFile, log, errorLog, config });
  }

  return result;
}

// MARK: argv parsing
type ParsedScanArgs = { readonly kind: 'parsed'; readonly project: string | undefined; readonly check: boolean; readonly out: string | undefined; readonly help: boolean } | { readonly kind: 'parse-error'; readonly message: string };

/**
 * Parses the shared scan CLI argv vocabulary (`--project`, `--check`,
 * `--out`, `--help`).
 *
 * @param argv - Argument tokens, excluding the node binary and script paths.
 * @returns Either the parsed flag bag or a `parse-error` describing the first malformed token.
 */
export function parseScanArgs(argv: readonly string[]): ParsedScanArgs {
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

  let result: ParsedScanArgs;
  if (error === undefined) {
    result = { kind: 'parsed', project, check, out, help };
  } else {
    result = { kind: 'parse-error', message: error };
  }
  return result;
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
  const { outcome, args, projectArg, readFile, writeFile, log, errorLog, config } = input;

  let result: RunScanCliResult;
  if (outcome.kind === 'success') {
    const finalOutPath = args.out === undefined ? outcome.outPath : resolve(outcome.outPath, '..', args.out);
    const serialized = config.serialize(outcome.manifest);
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
        errorLog(`  dbx-components-mcp ${config.subcommand} --project ${projectArg}`);
        result = { exitCode: 1 };
      }
    } else {
      await writeFile(finalOutPath, serialized);
      log(`Wrote manifest: ${finalOutPath} (${outcome.manifest.entries.length} entries, ${outcome.scannedFileCount} files scanned)`);
      for (const warning of outcome.extractWarnings) {
        errorLog(`extract-warning: ${config.formatExtractWarning(warning)}`);
      }
      result = { exitCode: 0 };
    }
  } else if (outcome.kind === 'no-config') {
    errorLog(`Error: no scan config at ${outcome.configPath}`);
    errorLog(`Create a dbx-mcp.scan.json file in the project root ${config.configSectionHint}`);
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
