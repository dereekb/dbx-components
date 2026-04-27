/**
 * `scan-filters` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the filters
 * domain config.
 */

import { buildFiltersManifest, serializeFilterManifest, type BuildFiltersGlobber } from './filters-build-manifest.js';
import { type FilterExtractWarning } from './filters-extract.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type FiltersScanCliReadFile = ScanCliBaseReadFile;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type FiltersScanCliWriteFile = ScanCliBaseWriteFile;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type FiltersScanCliLogger = ScanCliBaseLogger;

/**
 * Input to {@link runFiltersScanCli}.
 */
export type RunFiltersScanCliInput = RunScanCliBaseInput<BuildFiltersGlobber>;

/**
 * Result of one CLI invocation.
 */
export type RunFiltersScanCliResult = RunScanCliResult;

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

// MARK: Entry point
/**
 * Runs one invocation of `scan-filters`. Never throws on user errors —
 * every failure path returns a structured exit code so callers can wire
 * this into `process.exit` without try/catch.
 *
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runFiltersScanCli(input: RunFiltersScanCliInput): Promise<RunFiltersScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-filters',
    usage: USAGE,
    configSectionHint: 'with a filters section.',
    buildManifest: buildFiltersManifest,
    serialize: serializeFilterManifest,
    formatExtractWarning
  });
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
