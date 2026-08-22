import type { CommandModule, Argv } from 'yargs';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { type Maybe, noop } from '@dereekb/util';
import { makeFileForFetch } from '@dereekb/util/fetch';
import { type ZohoAnalyticsImportFileType, type ZohoAnalyticsImportOnError, type ZohoAnalyticsImportType, type ZohoAnalyticsName, isZohoAnalyticsJobComplete } from '@dereekb/zoho';
import { getAnalyticsApi } from '../../middleware/auth.middleware';
import { outputResult, outputError } from '../../util/output';

const IMPORT_TYPES: ZohoAnalyticsImportType[] = ['append', 'truncateadd', 'updateadd'];
const ON_ERROR_MODES: ZohoAnalyticsImportOnError[] = ['abort', 'skiprow', 'setcolumnempty'];

/**
 * Reads the file at the given path into a File carrying its name and inferred content type, so Zoho
 * can identify the format.
 *
 * @param path - Path of the local file to import.
 * @returns The file to upload.
 */
async function readImportFile(path: string): Promise<File> {
  const content = await readFile(path, 'utf8');
  const fileName = basename(path);
  const mimeType = extname(path).toLowerCase() === '.json' ? 'application/json' : 'text/csv';
  return makeFileForFetch({ content, fileName, mimeType });
}

/**
 * Infers the import file type from the file's extension.
 *
 * @param path - Path of the local file to import.
 * @returns The inferred file type, or undefined when it cannot be inferred.
 */
export function inferFileType(path: string): Maybe<ZohoAnalyticsImportFileType> {
  const extension = extname(path).toLowerCase();
  const byExtension: Record<string, ZohoAnalyticsImportFileType> = { '.json': 'json', '.csv': 'csv' };
  return byExtension[extension];
}

/**
 * Parses the `--matching-columns` value, enforcing that the `updateadd` mode has one.
 *
 * Blank entries are discarded so that a value of `','` is treated as no columns rather than as two
 * unnamed ones, which would reach Zoho as an unusable match set.
 *
 * @param importType - The import mode the command was given.
 * @param value - Raw comma-separated `--matching-columns` value, if any.
 * @returns The parsed column names, or undefined when none were given.
 * @throws {Error} When the mode is `updateadd` and no usable column was given.
 */
export function importMatchingColumns(importType: ZohoAnalyticsImportType, value: Maybe<string>): Maybe<ZohoAnalyticsName[]> {
  const columns = value
    ?.split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

  if (importType === 'updateadd' && !columns?.length) {
    throw new Error('The updateadd mode requires --matching-columns.');
  }

  return columns?.length ? columns : undefined;
}

/**
 * Adds the options shared by every import command.
 *
 * @param yargs - The yargs builder to extend.
 * @returns The builder with the shared import options applied.
 */
function withImportOptions(yargs: Argv): Argv {
  return yargs
    .option('file', { alias: 'f', type: 'string', demandOption: true, describe: 'Path to the CSV or JSON file to import' })
    .option('file-type', { type: 'string', choices: ['csv', 'json'], describe: 'Format of the file. Inferred from its extension when omitted' })
    .option('on-error', { type: 'string', choices: ON_ERROR_MODES, describe: 'What to do when a row cannot be imported' })
    .option('async', { type: 'boolean', default: false, describe: 'Queue the import as a job and poll it, rather than waiting on one request' });
}

const importDataCommand: CommandModule = {
  command: 'data <workspaceId> <viewId>',
  describe: 'Import a file into an existing table',
  builder: (yargs: Argv) =>
    withImportOptions(yargs)
      .positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' })
      .positional('viewId', { type: 'string', demandOption: true, describe: 'Target table view ID' })
      .option('mode', { alias: 'm', type: 'string', choices: IMPORT_TYPES, default: 'append', describe: 'append adds rows, truncateadd replaces every row, updateadd upserts on --matching-columns' })
      .option('matching-columns', { type: 'string', describe: 'Comma-separated columns to match on. Required for the updateadd mode' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const importType = argv.mode as ZohoAnalyticsImportType;
      const matchingColumns = importMatchingColumns(importType, argv.matchingColumns as Maybe<string>);
      const file = await readImportFile(argv.file);
      const config = {
        importType,
        fileType: (argv.fileType as ZohoAnalyticsImportFileType) ?? inferFileType(argv.file),
        onError: argv.onError as ZohoAnalyticsImportOnError,
        matchingColumns
      };

      if (argv.async) {
        const result = await api.importDataInTableAndAwaitJob({ workspaceId: argv.workspaceId, viewId: argv.viewId, file, config });
        const { jobCode, jobStatus, jobInfo } = result.data;
        outputResult({ jobCode, jobStatus, ...jobInfo }, { complete: isZohoAnalyticsJobComplete(jobCode) });
      } else {
        const result = await api.importDataInTable({ workspaceId: argv.workspaceId, viewId: argv.viewId, file, config });
        outputResult(result.data);
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const importNewTableCommand: CommandModule = {
  command: 'new-table <workspaceId> <tableName>',
  describe: 'Create a table in a workspace from an imported file',
  builder: (yargs: Argv) => withImportOptions(yargs).positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }).positional('tableName', { type: 'string', demandOption: true, describe: 'Name of the table to create' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const file = await readImportFile(argv.file);
      const config = {
        tableName: argv.tableName,
        fileType: (argv.fileType as ZohoAnalyticsImportFileType) ?? inferFileType(argv.file),
        onError: argv.onError as ZohoAnalyticsImportOnError
      };

      if (argv.async) {
        const result = await api.createImportJobInNewTable({ workspaceId: argv.workspaceId, file, config });
        outputResult(result.data);
      } else {
        const result = await api.importDataInNewTable({ workspaceId: argv.workspaceId, file, config });
        outputResult(result.data);
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const importJobCommand: CommandModule = {
  command: 'job <workspaceId> <jobId>',
  describe: 'Get the status of an asynchronous import job',
  builder: (yargs: Argv) => yargs.positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }).positional('jobId', { type: 'string', demandOption: true, describe: 'Import job ID' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const result = await api.getImportJob({ workspaceId: argv.workspaceId, jobId: argv.jobId });
      outputResult(result.data, { complete: isZohoAnalyticsJobComplete(result.data.jobCode) });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const ANALYTICS_IMPORT_COMMAND: CommandModule = {
  command: 'import',
  describe: 'Analytics import operations',
  builder: (yargs: Argv) =>
    yargs
      .command(importDataCommand)
      .command(importNewTableCommand)
      .command(importJobCommand)
      .demandCommand(1)
      .example([
        ['$0 analytics import data WS VIEW -f rows.csv', 'Append the rows of a CSV to a table'],
        ['$0 analytics import data WS VIEW -f rows.csv -m truncateadd', 'Replace every row in a table'],
        ['$0 analytics import data WS VIEW -f big.csv --async', 'Queue a large import and poll it'],
        ['$0 analytics import new-table WS Sales -f rows.csv', 'Create a table from a CSV']
      ]),
  handler: noop
};
