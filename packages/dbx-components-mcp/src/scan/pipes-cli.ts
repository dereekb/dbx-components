/**
 * `scan-pipes` subcommand entry point.
 *
 * Thin wrapper around {@link runScanCliBase} that supplies the pipes
 * domain config.
 */

import { buildPipesManifest, serializePipeManifest, type BuildPipesGlobber } from './pipes-build-manifest.js';
import { type PipeExtractWarning } from './pipes-extract.js';
import { runScanCliBase, type RunScanCliBaseInput, type RunScanCliResult, type ScanCliBaseLogger, type ScanCliBaseReadFile, type ScanCliBaseWriteFile } from './scan-cli-base.js';

// MARK: Public types
/**
 * Function shape used to read text files during `--check`.
 */
export type PipesScanCliReadFile = ScanCliBaseReadFile;

/**
 * Function shape used to write the produced manifest in write mode.
 */
export type PipesScanCliWriteFile = ScanCliBaseWriteFile;

/**
 * Console-shaped sink for stdout and stderr lines.
 */
export type PipesScanCliLogger = ScanCliBaseLogger;

/**
 * Input to {@link runPipesScanCli}.
 */
export type RunPipesScanCliInput = RunScanCliBaseInput<BuildPipesGlobber>;

/**
 * Result of one CLI invocation.
 */
export type RunPipesScanCliResult = RunScanCliResult;

const USAGE = [
  'Usage: dbx-components-mcp scan-pipes --project <dir> [--check] [--out <path>] [--help]',
  '',
  'Generates a PipeManifest by walking <dir> for classes tagged with @dbxPipe.',
  '',
  'Options:',
  '  --project <dir>   Project root containing dbx-mcp.scan.json and package.json',
  '  --check           Verify the on-disk manifest matches a fresh scan; exit 1 on drift',
  '  --out <path>      Override the `out` path from the scan config (project-relative)',
  '  --help            Show this message'
].join('\n');

// MARK: Entry point
/**
 * Runs one invocation of `scan-pipes`. Never throws on user errors — every
 * failure path returns a structured exit code so callers can wire this
 * into `process.exit` without try/catch.
 *
 * @param input - argv plus injectable I/O hooks
 * @returns the CLI's exit code (0 on success, 1 on drift / build failure, 2 on usage error)
 */
export async function runPipesScanCli(input: RunPipesScanCliInput): Promise<RunPipesScanCliResult> {
  return runScanCliBase(input, {
    subcommand: 'scan-pipes',
    usage: USAGE,
    configSectionHint: 'with a pipes section.',
    buildManifest: buildPipesManifest,
    serialize: serializePipeManifest,
    formatExtractWarning
  });
}

function formatExtractWarning(warning: PipeExtractWarning): string {
  let result: string;
  switch (warning.kind) {
    case 'missing-required-tag':
      result = `${warning.className} (${warning.filePath}:${warning.line}) missing @${warning.tag}`;
      break;
    case 'unknown-category':
      result = `${warning.className} (${warning.filePath}:${warning.line}) unknown category "${warning.category}"`;
      break;
    case 'missing-pipe-decorator':
      result = `${warning.className} (${warning.filePath}:${warning.line}) missing @Pipe() decorator`;
      break;
    case 'missing-transform-method':
      result = `${warning.className} (${warning.filePath}:${warning.line}) missing transform() method`;
      break;
  }
  return result;
}
