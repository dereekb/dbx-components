/**
 * `scan-forge-fields` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the forge-fields
 * domain config.
 */

import { buildForgeFieldsManifest, serializeForgeFieldManifest, type BuildForgeFieldsGlobber } from './forge-fields-build-manifest.js';
import { type ForgeExtractWarning } from './forge-fields-extract.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type ForgeFieldsScanCliReadFile = ScanCliBaseReadFile;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type ForgeFieldsScanCliWriteFile = ScanCliBaseWriteFile;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type ForgeFieldsScanCliLogger = ScanCliBaseLogger;

/**
 * Input to {@link runForgeFieldsScanCli}.
 */
export type RunForgeFieldsScanCliInput = RunScanCliBaseInput<BuildForgeFieldsGlobber>;

/**
 * Result of one CLI invocation.
 */
export type RunForgeFieldsScanCliResult = RunScanCliResult;

const USAGE = [
  'Usage: dbx-components-mcp scan-forge-fields --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a ForgeFieldManifest by walking <dir> for factories tagged with @dbxFormField.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

// MARK: Entry point
/**
 * Runs one invocation of `scan-forge-fields`. Never throws on user errors —
 * every failure path returns a structured exit code so callers can wire
 * this into `process.exit` without try/catch.
 *
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runForgeFieldsScanCli(input: RunForgeFieldsScanCliInput): Promise<RunForgeFieldsScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-forge-fields',
    usage: USAGE,
    configSectionHint: 'with a forgeFields section.',
    buildManifest: buildForgeFieldsManifest,
    serialize: serializeForgeFieldManifest,
    formatExtractWarning
  });
}

function formatExtractWarning(warning: ForgeExtractWarning): string {
  let result: string;
  switch (warning.kind) {
    case 'missing-required-tag':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) missing @${warning.tag}`;
      break;
    case 'unknown-tier':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) unknown tier "${warning.tier}"`;
      break;
    case 'unknown-array-output':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) unknown array-output "${warning.arrayOutput}"`;
      break;
    case 'unknown-wrapper-pattern':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) unknown wrapper-pattern "${warning.wrapperPattern}"`;
      break;
    case 'unknown-suffix':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) unknown suffix "${warning.suffix}"`;
      break;
    case 'config-interface-not-found':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) config interface "${warning.configInterfaceName}" not found in scanned files`;
      break;
    case 'derivative-missing-base':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) field-derivative tier requires @dbxFormFieldDerivative <baseSlug> or @dbxFormComposesFrom`;
      break;
    case 'derivative-multiple-bases':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) field-derivative tier expects single base; got ${warning.providedCount}`;
      break;
    case 'template-missing-slugs':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) template-builder tier requires @dbxFormFieldTemplate <slug,...> or @dbxFormComposesFrom`;
      break;
    case 'union-config-not-walked':
      result = `${warning.factoryName} (${warning.filePath}:${warning.line}) config type "${warning.configInterfaceName}" is a primitive-only union — no properties extracted; consider pointing @dbxFormConfigInterface at an object branch`;
      break;
  }
  return result;
}
