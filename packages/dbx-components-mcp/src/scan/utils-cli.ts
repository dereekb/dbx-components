/**
 * `scan-utils` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the utils
 * domain config.
 */

import { buildUtilsManifest, serializeUtilManifest, type BuildUtilsGlobber } from './utils-build-manifest.js';
import { type UtilExtractWarning } from './utils-extract.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type UtilsScanCliReadFile = ScanCliBaseReadFile;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type UtilsScanCliWriteFile = ScanCliBaseWriteFile;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type UtilsScanCliLogger = ScanCliBaseLogger;

/**
 * Input to {@link runUtilsScanCli}.
 */
export type RunUtilsScanCliInput = RunScanCliBaseInput<BuildUtilsGlobber>;

/**
 * Result of one CLI invocation.
 */
export type RunUtilsScanCliResult = RunScanCliResult;

const USAGE = [
  'Usage: dbx-components-mcp scan-utils --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a UtilManifest by walking <dir> for exports tagged with @dbxUtil.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

// MARK: Entry point
/**
 * Runs one invocation of `scan-utils`. Never throws on user errors —
 * every failure path returns a structured exit code so callers can wire
 * this into `process.exit` without try/catch.
 *
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runUtilsScanCli(input: RunUtilsScanCliInput): Promise<RunUtilsScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-utils',
    usage: USAGE,
    configSectionHint: 'with a utils section.',
    buildManifest: buildUtilsManifest,
    serialize: serializeUtilManifest,
    formatExtractWarning
  });
}

function formatExtractWarning(warning: UtilExtractWarning): string {
  let result: string;
  switch (warning.kind) {
    case 'unsupported-kind-override':
      result = `${warning.name} (${warning.filePath}:${warning.line}) unsupported @dbxUtilKind value "${warning.override}"`;
      break;
    case 'missing-name':
      result = `(anonymous) (${warning.filePath}:${warning.line}) tagged export has no resolvable name`;
      break;
    case 'duplicate-slug':
      result = `${warning.name} (${warning.filePath}:${warning.line}) duplicate slug "${warning.slug}" — already used by ${warning.previousName}`;
      break;
  }
  return result;
}
