/**
 * `scan-actions` subcommand entry point.
 */

import { readFile as nodeReadFile, writeFile as nodeWriteFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildActionsManifest, serializeActionManifest, type BuildActionsGlobber, type BuildActionsManifestOutcome } from './actions-build-manifest.js';
import { type ActionExtractWarning } from './actions-extract.js';

export type ActionsScanCliReadFile = (absolutePath: string) => Promise<string>;
export type ActionsScanCliWriteFile = (absolutePath: string, data: string) => Promise<void>;
export type ActionsScanCliLogger = (message: string) => void;

export interface RunActionsScanCliInput {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly generator: string;
  readonly readFile?: ActionsScanCliReadFile;
  readonly writeFile?: ActionsScanCliWriteFile;
  readonly globber?: BuildActionsGlobber;
  readonly now?: () => Date;
  readonly log?: ActionsScanCliLogger;
  readonly errorLog?: ActionsScanCliLogger;
}

export interface RunActionsScanCliResult {
  readonly exitCode: number;
}

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

const DEFAULT_READ_FILE: ActionsScanCliReadFile = (path) => nodeReadFile(path, 'utf-8');
const DEFAULT_WRITE_FILE: ActionsScanCliWriteFile = (path, data) => nodeWriteFile(path, data, 'utf-8');

export async function runActionsScanCli(input: RunActionsScanCliInput): Promise<RunActionsScanCliResult> {
  const { argv, cwd, generator, readFile = DEFAULT_READ_FILE, writeFile = DEFAULT_WRITE_FILE, globber, now, log = console.log, errorLog = console.error } = input;

  let result: RunActionsScanCliResult;
  const args = parseArgs(argv);

  if (args.kind === 'parse-error') {
    errorLog(`Error: ${args.message}`);
    errorLog(USAGE);
    result = { exitCode: 2 };
  } else if (args.help) {
    log(USAGE);
    result = { exitCode: 0 };
  } else if (args.project === undefined) {
    errorLog('Error: --project is required');
    errorLog(USAGE);
    result = { exitCode: 2 };
  } else {
    const projectRoot = resolve(cwd, args.project);
    const outcome = await buildActionsManifest({ projectRoot, generator, readFile, globber, now });
    result = await handleOutcome({ outcome, args, projectArg: args.project, readFile, writeFile, log, errorLog });
  }

  return result;
}

type ParsedArgs = { readonly kind: 'parsed'; readonly project: string | undefined; readonly check: boolean; readonly out: string | undefined; readonly help: boolean } | { readonly kind: 'parse-error'; readonly message: string };

function parseArgs(argv: readonly string[]): ParsedArgs {
  let project: string | undefined;
  let out: string | undefined;
  let check = false;
  let help = false;
  let error: string | undefined;
  let index = 0;
  while (index < argv.length && error === undefined) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      help = true;
      index += 1;
    } else if (token === '--check') {
      check = true;
      index += 1;
    } else if (token === '--project') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        error = '--project requires a value';
      } else {
        project = value;
        index += 2;
      }
    } else if (token.startsWith('--project=')) {
      project = token.slice('--project='.length);
      index += 1;
    } else if (token === '--out') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        error = '--out requires a value';
      } else {
        out = value;
        index += 2;
      }
    } else if (token.startsWith('--out=')) {
      out = token.slice('--out='.length);
      index += 1;
    } else {
      error = `Unknown argument: ${token}`;
    }
  }
  return error === undefined ? { kind: 'parsed', project, check, out, help } : { kind: 'parse-error', message: error };
}

interface HandleOutcomeInput {
  readonly outcome: BuildActionsManifestOutcome;
  readonly args: Extract<ParsedArgs, { kind: 'parsed' }>;
  readonly projectArg: string;
  readonly readFile: ActionsScanCliReadFile;
  readonly writeFile: ActionsScanCliWriteFile;
  readonly log: ActionsScanCliLogger;
  readonly errorLog: ActionsScanCliLogger;
}

async function handleOutcome(input: HandleOutcomeInput): Promise<RunActionsScanCliResult> {
  const { outcome, args, projectArg, readFile, writeFile, log, errorLog } = input;

  let result: RunActionsScanCliResult;
  if (outcome.kind === 'success') {
    const finalOutPath = args.out === undefined ? outcome.outPath : resolve(outcome.outPath, '..', args.out);
    const serialized = serializeActionManifest(outcome.manifest);
    if (args.check) {
      let existing: string | null = null;
      try {
        existing = await readFile(finalOutPath);
      } catch {
        existing = null;
      }
      if (existing === serialized) {
        log(`Manifest fresh: ${finalOutPath} (${outcome.manifest.entries.length} entries, ${outcome.scannedFileCount} files scanned)`);
        result = { exitCode: 0 };
      } else {
        errorLog(`Manifest is stale at ${finalOutPath}.`);
        errorLog('Regenerate by running:');
        errorLog(`  dbx-components-mcp scan-actions --project ${projectArg}`);
        result = { exitCode: 1 };
      }
    } else {
      await writeFile(finalOutPath, serialized);
      log(`Wrote manifest: ${finalOutPath} (${outcome.manifest.entries.length} entries, ${outcome.scannedFileCount} files scanned)`);
      for (const warning of outcome.extractWarnings) {
        errorLog(`extract-warning: ${formatExtractWarning(warning)}`);
      }
      result = { exitCode: 0 };
    }
  } else if (outcome.kind === 'no-config') {
    errorLog(`Error: no scan config at ${outcome.configPath}`);
    errorLog('Create a dbx-mcp.scan.json file in the project root with an actions section.');
    result = { exitCode: 1 };
  } else if (outcome.kind === 'invalid-scan-config') {
    errorLog(`Error: invalid scan config at ${outcome.configPath}`);
    errorLog(outcome.error);
    result = { exitCode: 1 };
  } else if (outcome.kind === 'no-package') {
    errorLog(`Error: no package.json at ${outcome.packagePath}`);
    result = { exitCode: 1 };
  } else if (outcome.kind === 'invalid-package') {
    errorLog(`Error: invalid package.json at ${outcome.packagePath}`);
    errorLog(outcome.error);
    result = { exitCode: 1 };
  } else {
    errorLog('Error: generated manifest failed schema validation');
    errorLog(outcome.error);
    result = { exitCode: 1 };
  }
  return result;
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
