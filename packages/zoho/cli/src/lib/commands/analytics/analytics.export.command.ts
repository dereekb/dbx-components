import type { CommandModule, Argv } from 'yargs';
import { writeFile } from 'node:fs/promises';
import { type Maybe, noop } from '@dereekb/util';
import { type ZohoAnalyticsExportResponseFormat, isZohoAnalyticsJobComplete } from '@dereekb/zoho';
import { getAnalyticsApi } from '../../middleware/auth.middleware';
import { outputResult, outputError } from '../../util/output';

const EXPORT_FORMATS: ZohoAnalyticsExportResponseFormat[] = ['csv', 'json', 'xml', 'xls', 'pdf', 'html', 'image'];

/**
 * Writes the body of an export response to a file, or returns it for printing.
 *
 * @param response - The export response carrying the file body.
 * @param out - Optional path to write the body to.
 * @returns The body text when no output path was given, otherwise undefined.
 */
async function handleExportBody(response: Response, out: Maybe<string>): Promise<Maybe<string>> {
  const body = await response.text();
  let result: Maybe<string>;

  if (out) {
    await writeFile(out, body, 'utf8');
  } else {
    result = body;
  }

  return result;
}

/**
 * Adds the options shared by the export commands.
 *
 * @param yargs - The yargs builder to extend.
 * @returns The builder with the shared export options applied.
 */
function withExportOptions(yargs: Argv): Argv {
  return yargs.option('format', { type: 'string', choices: EXPORT_FORMATS, default: 'csv', describe: 'Format of the exported data' }).option('out', { alias: 'o', type: 'string', describe: 'Write the export to this file instead of printing it' }).option('criteria', { type: 'string', describe: `Filter expression, e.g. "Sales"."Region"='West'` }).option('columns', { type: 'string', describe: 'Comma-separated columns to export' });
}

/**
 * Parses a comma-separated column list, discarding blank entries so that a value of `','` reads as
 * no columns rather than as two unnamed ones.
 *
 * @param value - Raw comma-separated value, if any.
 * @returns The column names, or undefined when none were given.
 */
export function parseColumnList(value: Maybe<string>): Maybe<string[]> {
  const columns = value
    ?.split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  return columns?.length ? columns : undefined;
}

/**
 * Builds the export config shared by the export commands.
 *
 * @param argv - The yargs-parsed arguments object.
 * @returns The export config to send to Zoho Analytics.
 */
export function exportConfigFromArgv(argv: any) {
  return {
    responseFormat: argv.format as ZohoAnalyticsExportResponseFormat,
    criteria: argv.criteria as Maybe<string> as string | undefined,
    selectedColumns: parseColumnList(argv.columns as Maybe<string>)
  };
}

const exportDataCommand: CommandModule = {
  command: 'data <workspaceId> <viewId>',
  describe: 'Export the data of a view',
  builder: (yargs: Argv) => withExportOptions(yargs).positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }).positional('viewId', { type: 'string', demandOption: true, describe: 'View ID' }).option('async', { type: 'boolean', default: false, describe: 'Queue the export as a job and poll it. Required for dashboards, query tables, and tables over a million rows' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const config = exportConfigFromArgv(argv);

      if (argv.async) {
        const job = await api.exportDataAndAwaitJob({ workspaceId: argv.workspaceId, viewId: argv.viewId, config });

        if (isZohoAnalyticsJobComplete(job.data.jobCode)) {
          const response = await api.downloadExport({ workspaceId: argv.workspaceId, jobId: job.data.jobId });
          const body = await handleExportBody(response, argv.out);
          outputResult(body ?? { written: argv.out, jobId: job.data.jobId });
        } else {
          outputResult(job.data, { complete: false });
        }
      } else {
        const response = await api.exportData({ workspaceId: argv.workspaceId, viewId: argv.viewId, config });
        const body = await handleExportBody(response, argv.out);
        outputResult(body ?? { written: argv.out });
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const exportQueryCommand: CommandModule = {
  command: 'query <workspaceId>',
  describe: 'Export the results of a SQL query',
  builder: (yargs: Argv) => withExportOptions(yargs).positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }).option('sql', { type: 'string', demandOption: true, describe: 'The SQL SELECT statement to run' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const config = { ...exportConfigFromArgv(argv), sqlQuery: argv.sql as string };
      const created = await api.createExportJobForSqlQuery({ workspaceId: argv.workspaceId, config });
      const job = await api.getExportJob({ workspaceId: argv.workspaceId, jobId: created.data.jobId });
      outputResult(job.data, { complete: isZohoAnalyticsJobComplete(job.data.jobCode) });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const exportJobCommand: CommandModule = {
  command: 'job <workspaceId> <jobId>',
  describe: 'Get the status of an asynchronous export job',
  builder: (yargs: Argv) => yargs.positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }).positional('jobId', { type: 'string', demandOption: true, describe: 'Export job ID' }).option('download', { type: 'boolean', default: false, describe: 'Download the export when the job has completed' }).option('out', { alias: 'o', type: 'string', describe: 'Write the download to this file instead of printing it' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const job = await api.getExportJob({ workspaceId: argv.workspaceId, jobId: argv.jobId });

      if (argv.download && isZohoAnalyticsJobComplete(job.data.jobCode)) {
        const response = await api.downloadExport({ workspaceId: argv.workspaceId, jobId: argv.jobId });
        const body = await handleExportBody(response, argv.out);
        outputResult(body ?? { written: argv.out });
      } else {
        outputResult(job.data, { complete: isZohoAnalyticsJobComplete(job.data.jobCode) });
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const ANALYTICS_EXPORT_COMMAND: CommandModule = {
  command: 'export',
  describe: 'Analytics export operations',
  builder: (yargs: Argv) =>
    yargs
      .command(exportDataCommand)
      .command(exportQueryCommand)
      .command(exportJobCommand)
      .demandCommand(1)
      .example([
        ['$0 analytics export data WS VIEW -o rows.csv', 'Export a table to a CSV file'],
        ['$0 analytics export data WS VIEW --format json', 'Print a table as JSON'],
        ['$0 analytics export query WS --sql "select * from Sales"', 'Queue an ad-hoc SQL export']
      ]),
  handler: noop
};
