/**
 * `scan-actions` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the actions
 * domain config — USAGE block, `buildActionsManifest` build function,
 * `serializeActionManifest` serializer, and the per-warning formatter.
 */

import { buildActionsManifest, serializeActionManifest, type BuildActionsGlobber } from './actions-build-manifest.js';
import { type ActionExtractWarning } from './actions-extract.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type ActionsScanCliReadFile = ScanCliBaseReadFile;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type ActionsScanCliWriteFile = ScanCliBaseWriteFile;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type ActionsScanCliLogger = ScanCliBaseLogger;

/**
 * Input to {@link runActionsScanCli}.
 */
export type RunActionsScanCliInput = RunScanCliBaseInput<BuildActionsGlobber>;

/**
 * Result of one CLI invocation.
 */
export type RunActionsScanCliResult = RunScanCliResult;

const USAGE = [
  'Usage: dbx-components-mcp scan-actions --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates an ActionManifest by walking <dir> for classes/enums tagged with @dbxAction / @dbxActionStateEnum.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

// MARK: Entry point
/**
 * Runs one invocation of `scan-actions`. Never throws on user errors —
 * every failure path returns a structured exit code so callers can wire
 * this into `process.exit` without try/catch.
 *
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runActionsScanCli(input: RunActionsScanCliInput): Promise<RunActionsScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-actions',
    usage: USAGE,
    configSectionHint: 'with an actions section.',
    buildManifest: buildActionsManifest,
    serialize: serializeActionManifest,
    formatExtractWarning
  });
}

function formatExtractWarning(warning: ActionExtractWarning): string {
  let result: string;
  switch (warning.kind) {
    case 'missing-required-tag':
      result = `${warning.className} (${warning.filePath}:${warning.line}) missing @${warning.tag}`;
      break;
    case 'unknown-role':
      result = `${warning.className} (${warning.filePath}:${warning.line}) unknown role "${warning.role}"`;
      break;
    case 'unknown-state-value':
      result = `${warning.className} (${warning.filePath}:${warning.line}) unknown state value "${warning.stateValue}"`;
      break;
    case 'missing-directive-decorator':
      result = `${warning.className} (${warning.filePath}:${warning.line}) missing @Directive() decorator`;
      break;
  }
  return result;
}
