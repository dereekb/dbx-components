/**
 * `scan-ui-components` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the
 * ui-components domain config.
 */

import { buildUiComponentsManifest, serializeUiComponentManifest, type BuildUiManifestGlobber } from './ui-components-build-manifest.js';
import { type ExtractWarning } from './ui-components-extract.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type UiScanCliReadFile = ScanCliBaseReadFile;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type UiScanCliWriteFile = ScanCliBaseWriteFile;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type UiScanCliLogger = ScanCliBaseLogger;

/**
 * Input to {@link runUiComponentsScanCli}.
 */
export type RunUiComponentsScanCliInput = RunScanCliBaseInput<BuildUiManifestGlobber>;

/**
 * Result of one CLI invocation.
 */
export type RunUiComponentsScanCliResult = RunScanCliResult;

const USAGE = [
  'Usage: dbx-components-mcp scan-ui-components --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a UiComponentManifest by walking <dir> for classes tagged with @dbxWebComponent.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

// MARK: Entry point
/**
 * Runs one invocation of `scan-ui-components`. Never throws on user errors —
 * every failure path returns a structured exit code so callers can wire
 * this into `process.exit` without try/catch.
 *
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runUiComponentsScanCli(input: RunUiComponentsScanCliInput): Promise<RunUiComponentsScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-ui-components',
    usage: USAGE,
    configSectionHint: 'with a uiComponents section.',
    buildManifest: buildUiComponentsManifest,
    serialize: serializeUiComponentManifest,
    formatExtractWarning
  });
}

function formatExtractWarning(warning: ExtractWarning): string {
  let result: string;
  switch (warning.kind) {
    case 'missing-required-tag':
      result = `${warning.className} (${warning.filePath}:${warning.line}) missing @${warning.tag}`;
      break;
    case 'unknown-category':
      result = `${warning.className} (${warning.filePath}:${warning.line}) unknown category "${warning.category}"`;
      break;
    case 'unknown-kind':
      result = `${warning.className} (${warning.filePath}:${warning.line}) unknown kind "${warning.kindValue}"`;
      break;
  }
  return result;
}
