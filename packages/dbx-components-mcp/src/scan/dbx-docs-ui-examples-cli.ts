/**
 * `scan-dbx-docs-ui-examples` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the
 * dbx-docs-ui-examples domain config.
 */

import { buildDbxDocsUiExamplesManifest, serializeDbxDocsUiExamplesManifest, type BuildDbxDocsUiExamplesManifestGlobber } from './dbx-docs-ui-examples-build-manifest.js';
import { type DbxDocsUiExamplesExtractWarning } from './dbx-docs-ui-examples-extract.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
export type DbxDocsUiExamplesScanCliReadFile = ScanCliBaseReadFile;
export type DbxDocsUiExamplesScanCliWriteFile = ScanCliBaseWriteFile;
export type DbxDocsUiExamplesScanCliLogger = ScanCliBaseLogger;
export type RunDbxDocsUiExamplesScanCliInput = RunScanCliBaseInput<BuildDbxDocsUiExamplesManifestGlobber>;
export type RunDbxDocsUiExamplesScanCliResult = RunScanCliResult;

const USAGE = [
  'Usage: dbx-components-mcp scan-dbx-docs-ui-examples --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a DbxDocsUiExampleManifest by walking <dir> for classes tagged with @dbxDocsUiExample.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

// MARK: Entry point
/**
 * Runs one invocation of `scan-dbx-docs-ui-examples`.
 *
 * @param input - Parsed CLI input including project root, optional `--out` override, and `--check` flag.
 * @returns The CLI exit code, written file paths, and any warnings produced by the scan.
 */
export async function runDbxDocsUiExamplesScanCli(input: RunDbxDocsUiExamplesScanCliInput): Promise<RunDbxDocsUiExamplesScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-dbx-docs-ui-examples',
    usage: USAGE,
    configSectionHint: 'with a dbxDocsUiExamples section.',
    buildManifest: buildDbxDocsUiExamplesManifest,
    serialize: serializeDbxDocsUiExamplesManifest,
    formatExtractWarning
  });
}

function formatExtractWarning(warning: DbxDocsUiExamplesExtractWarning): string {
  switch (warning.kind) {
    case 'missing-required-tag':
      return `${warning.className} (${warning.filePath}:${warning.line}) missing @${warning.tag}`;
    case 'unknown-category':
      return `${warning.className} (${warning.filePath}:${warning.line}) unknown category "${warning.category}"`;
    case 'missing-component-decorator':
      return `${warning.className} (${warning.filePath}:${warning.line}) missing @Component decorator`;
    case 'missing-template':
      return `${warning.className} (${warning.filePath}:${warning.line}) missing template / templateUrl`;
    case 'missing-example-root':
      return `${warning.className} (${warning.filePath}:${warning.line}) template missing <dbx-docs-ui-example> root`;
    case 'missing-example-content':
      return `${warning.className} (${warning.filePath}:${warning.line}) template missing <dbx-docs-ui-example-content>`;
    case 'template-url-unreadable':
      return `${warning.className} (${warning.filePath}:${warning.line}) could not read templateUrl ${warning.templatePath}`;
    case 'uses-unresolved':
      return `${warning.className} (${warning.filePath}:${warning.line}) @dbxDocsUiExampleUses ${warning.identifier} could not be resolved`;
  }
}
