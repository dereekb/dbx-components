/**
 * `scan-css-utilities` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the
 * css-utilities domain config.
 */

import { buildCssUtilitiesManifest, serializeCssUtilityManifest, type BuildCssUtilitiesGlobber } from './css-utilities-build-manifest.js';
import { type ExtractWarning } from './css-utilities-extract.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type CssUtilitiesScanCliReadFile = ScanCliBaseReadFile;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type CssUtilitiesScanCliWriteFile = ScanCliBaseWriteFile;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type CssUtilitiesScanCliLogger = ScanCliBaseLogger;

/**
 * Input to {@link runCssUtilitiesScanCli}.
 */
export type RunCssUtilitiesScanCliInput = RunScanCliBaseInput<BuildCssUtilitiesGlobber>;

/**
 * Result of one CLI invocation.
 */
export type RunCssUtilitiesScanCliResult = RunScanCliResult;

const USAGE = [
  'Usage: dbx-components-mcp scan-css-utilities --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a CssUtilityManifest by scanning <dir> for `/// @dbx-utility` annotated SCSS rules.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

// MARK: Entry point
/**
 * Runs one invocation of `scan-css-utilities`. Never throws on user errors —
 * every failure path returns a structured exit code.
 *
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runCssUtilitiesScanCli(input: RunCssUtilitiesScanCliInput): Promise<RunCssUtilitiesScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-css-utilities',
    usage: USAGE,
    configSectionHint: 'with a cssUtilities section.',
    buildManifest: buildCssUtilitiesManifest,
    serialize: serializeCssUtilityManifest,
    formatExtractWarning
  });
}

function formatExtractWarning(warning: ExtractWarning): string {
  let result: string;
  switch (warning.kind) {
    case 'unsupported-selector':
      result = `${warning.file}:${warning.line} unsupported selector "${warning.selector}" (only flat single-class selectors are recognised)`;
      break;
    case 'unknown-role':
      result = `${warning.file}:${warning.line} ${warning.slug}: unknown role "${warning.role}"`;
      break;
    case 'unknown-scope':
      result = `${warning.file}:${warning.line} ${warning.slug}: unknown scope "${warning.scope}"`;
      break;
    case 'orphan-annotation':
      result = `${warning.file}:${warning.line} orphan @dbx-utility annotation (no following rule)`;
      break;
  }
  return result;
}
