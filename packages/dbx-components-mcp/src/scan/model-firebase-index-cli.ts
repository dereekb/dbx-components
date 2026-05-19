/**
 * `scan-model-firebase-indexes` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the
 * model-firebase-index domain config.
 */

import { buildModelFirebaseIndexManifest, formatModelFirebaseIndexBuildWarning, serializeModelFirebaseIndexManifest, type BuildModelFirebaseIndexGlobber } from '../../../dbx-cli/firestore-indexes/src/model-firebase-index-build-manifest.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
export type ModelFirebaseIndexScanCliReadFile = ScanCliBaseReadFile;
export type ModelFirebaseIndexScanCliWriteFile = ScanCliBaseWriteFile;
export type ModelFirebaseIndexScanCliLogger = ScanCliBaseLogger;
export type RunModelFirebaseIndexScanCliInput = RunScanCliBaseInput<BuildModelFirebaseIndexGlobber>;
export type RunModelFirebaseIndexScanCliResult = RunScanCliResult;

const USAGE = [
  'Usage: dbx-components-mcp scan-model-firebase-indexes --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a ModelFirebaseIndexManifest by walking <dir> for query factories tagged with @dbxModelFirebaseIndex.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

// MARK: Entry point
/**
 * Runs one invocation of `scan-model-firebase-indexes`. Never throws on
 * user errors — every failure path returns a structured exit code so
 * callers can wire this into `process.exit` without try/catch.
 *
 * @param input - Argv plus injectable I/O hooks.
 * @returns The CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runModelFirebaseIndexScanCli(input: RunModelFirebaseIndexScanCliInput): Promise<RunModelFirebaseIndexScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-model-firebase-indexes',
    usage: USAGE,
    configSectionHint: 'with a modelFirebaseIndex section.',
    buildManifest: buildModelFirebaseIndexManifest,
    serialize: serializeModelFirebaseIndexManifest,
    formatExtractWarning: formatModelFirebaseIndexBuildWarning
  });
}
