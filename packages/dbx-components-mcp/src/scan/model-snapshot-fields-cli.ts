/**
 * `scan-model-snapshot-fields` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the
 * model-snapshot-fields domain config.
 */

import { buildModelSnapshotFieldsManifest, serializeModelSnapshotFieldsManifest, type BuildModelSnapshotFieldsGlobber } from './model-snapshot-fields-build-manifest.js';
import { type ModelSnapshotFieldExtractWarning } from './model-snapshot-fields-extract.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type ModelSnapshotFieldsScanCliReadFile = ScanCliBaseReadFile;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type ModelSnapshotFieldsScanCliWriteFile = ScanCliBaseWriteFile;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type ModelSnapshotFieldsScanCliLogger = ScanCliBaseLogger;

/**
 * Input to {@link runModelSnapshotFieldsScanCli}.
 */
export type RunModelSnapshotFieldsScanCliInput = RunScanCliBaseInput<BuildModelSnapshotFieldsGlobber>;

/**
 * Result of one CLI invocation.
 */
export type RunModelSnapshotFieldsScanCliResult = RunScanCliResult;

const USAGE = [
  'Usage: dbx-components-mcp scan-model-snapshot-fields --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a ModelSnapshotFieldManifest by walking <dir> for exports tagged with @dbxModelSnapshotField.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

// MARK: Entry point
/**
 * Runs one invocation of `scan-model-snapshot-fields`. Never throws on
 * user errors — every failure path returns a structured exit code so
 * callers can wire this into `process.exit` without try/catch.
 *
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runModelSnapshotFieldsScanCli(input: RunModelSnapshotFieldsScanCliInput): Promise<RunModelSnapshotFieldsScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-model-snapshot-fields',
    usage: USAGE,
    configSectionHint: 'with a modelSnapshotFields section.',
    buildManifest: buildModelSnapshotFieldsManifest,
    serialize: serializeModelSnapshotFieldsManifest,
    formatExtractWarning
  });
}

function formatExtractWarning(warning: ModelSnapshotFieldExtractWarning): string {
  let result: string;
  switch (warning.kind) {
    case 'unsupported-kind-override':
      result = `${warning.name} (${warning.filePath}:${warning.line}) unsupported @dbxModelSnapshotFieldKind value "${warning.override}"`;
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
