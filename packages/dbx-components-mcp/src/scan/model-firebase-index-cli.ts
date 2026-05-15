/**
 * `scan-model-firebase-indexes` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the
 * model-firebase-index domain config.
 */

import { buildModelFirebaseIndexManifest, serializeModelFirebaseIndexManifest, type BuildModelFirebaseIndexGlobber, type ModelFirebaseIndexBuildWarning } from './model-firebase-index-build-manifest.js';
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
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runModelFirebaseIndexScanCli(input: RunModelFirebaseIndexScanCliInput): Promise<RunModelFirebaseIndexScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-model-firebase-indexes',
    usage: USAGE,
    configSectionHint: 'with a modelFirebaseIndex section.',
    buildManifest: buildModelFirebaseIndexManifest,
    serialize: serializeModelFirebaseIndexManifest,
    formatExtractWarning
  });
}

function formatExtractWarning(warning: ModelFirebaseIndexBuildWarning): string {
  if (warning.stage === 'analyze') {
    const w = warning.warning;
    switch (w.kind) {
      case 'multiple-range-fields':
        return `${w.factoryName} multiple range-field constraints on [${w.fields.join(', ')}] — Firestore allows only one range field per query`;
      case 'orderby-conflict':
        return `${w.factoryName} field "${w.field}" has conflicting orderBy directions [${w.directions.join(', ')}]`;
      case 'unsupported-array-contains-any':
        return `${w.factoryName} field "${w.field}" uses array-contains-any — index support is partial`;
    }
  }
  const w = warning.warning;
  switch (w.kind) {
    case 'missing-name':
      return `(anonymous) (${w.filePath}:${w.line}) tagged export has no resolvable name`;
    case 'missing-model-tag':
      return `${w.name} (${w.filePath}:${w.line}) missing required @dbxModelFirebaseIndexModel tag`;
    case 'unresolved-model':
      return `${w.name} (${w.filePath}:${w.line}) could not resolve model "${w.model}" to a Firestore identity`;
    case 'unsupported-scope':
      return `${w.name} (${w.filePath}:${w.line}) unsupported @dbxModelFirebaseIndexScope value "${w.scope}"`;
    case 'duplicate-slug':
      return `${w.name} (${w.filePath}:${w.line}) duplicate slug "${w.slug}" — already used by ${w.previousName}`;
    case 'unknown-helper':
      return `${w.name} (${w.filePath}:${w.line}) unknown constraint helper "${w.helper}"`;
    case 'unresolved-field':
      return `${w.name} (${w.filePath}:${w.line}) could not resolve field-path argument to "${w.callee}"`;
    case 'missing-paths':
      return `${w.name} (${w.filePath}:${w.line}) missing path coverage for conditional fields [${w.conditionalFields.join(', ')}]`;
    case 'unknown-path-field':
      return `${w.name} (${w.filePath}:${w.line}) @dbxModelFirebaseIndexPath references unknown field "${w.field}"`;
    case 'unannotated-query-helper':
      return `${w.name} (${w.filePath}:${w.line}) calls query helper "${w.callee}" (${w.calleeFilePath}:${w.calleeLine}) that is not tagged with @dbxModelFirebaseIndexHelper`;
    case 'transitive-cycle':
      return `${w.name} (${w.filePath}:${w.line}) transitive constraint resolution hit a cycle through "${w.callee}"`;
    case 'unresolvable-transitive-callee':
      return `${w.name} (${w.filePath}:${w.line}) could not resolve transitive callee "${w.callee}"`;
  }
}
