import type { CommandModule, Argv } from 'yargs';
import { readFile } from 'node:fs/promises';
import { noop } from '@dereekb/util';
import { type ZohoAnalyticsImportFileType, type ZohoAnalyticsSchemaDiff, isZohoAnalyticsSchemaDiffClean, zohoAnalyticsRowDataFromFileContent, zohoAnalyticsSchemaDiff } from '@dereekb/zoho';
import { getAnalyticsApi } from '../../middleware/auth.middleware';
import { outputResult, outputError } from '../../util/output';
import { inferFileType } from './analytics.import.command';

/**
 * Counts of everything a diff found, surfaced as the result's `meta` so a caller can read the shape
 * of the drift without walking the arrays.
 *
 * @param diff - The diff to summarize.
 * @param clean - Whether the diff counts as clean under the requested strictness.
 * @returns The summary to attach to the output.
 */
function diffSummary(diff: ZohoAnalyticsSchemaDiff, clean: boolean): Record<string, unknown> {
  return {
    clean,
    rowCount: diff.rowCount,
    matched: diff.matchedColumns.length,
    dropped: diff.droppedColumns.length,
    empty: diff.emptyColumns.length,
    emptyRequired: diff.emptyColumns.filter((x) => x.required).length,
    caseMismatched: diff.caseMismatchedColumns.length,
    conflicts: diff.conflicts.length,
    conflictingValues: diff.conflicts.reduce((total, x) => total + x.conflictCount, 0)
  };
}

const diffSchemaCommand: CommandModule = {
  command: 'schema <workspaceId> <viewId>',
  describe: 'Compare a file against a table before importing it',
  builder: (yargs: Argv) =>
    yargs
      .positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' })
      .positional('viewId', { type: 'string', demandOption: true, describe: 'Target table view ID' })
      .option('file', { alias: 'f', type: 'string', demandOption: true, describe: 'Path to the CSV or JSON file that would be imported' })
      .option('file-type', { type: 'string', choices: ['csv', 'json'], describe: 'Format of the file. Inferred from its extension when omitted' })
      .option('delimiter', { type: 'string', describe: 'Field delimiter of the CSV. Defaults to a comma' })
      .option('max-samples', { type: 'number', describe: 'Offending values to report per conflict. Defaults to 3' })
      .option('strict', { type: 'boolean', default: false, describe: 'Also treat a nullable column the file omits as drift' })
      .option('quiet', { type: 'boolean', default: false, describe: 'Report only through the exit code, printing nothing' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const fileType = (argv.fileType as ZohoAnalyticsImportFileType) ?? inferFileType(argv.file);

      if (fileType == null) {
        throw new Error(`Cannot tell the format of "${argv.file}" from its extension. Pass --file-type csv or --file-type json.`);
      }

      const content = await readFile(argv.file, 'utf8');
      const rowData = zohoAnalyticsRowDataFromFileContent({ content, fileType, delimiter: argv.delimiter });
      const { data } = await api.getTableMetadata({ workspaceId: argv.workspaceId, viewId: argv.viewId });

      const diff = zohoAnalyticsSchemaDiff({ ...rowData, columns: data.columns ?? [], maxSamples: argv.maxSamples });
      const clean = isZohoAnalyticsSchemaDiffClean(diff, { strict: argv.strict });

      if (!argv.quiet) {
        outputResult(diff, diffSummary(diff, clean));
      }

      // a non-zero exit is what makes this usable as a pre-import gate in a script or CI job
      if (!clean) {
        process.exit(1);
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const ANALYTICS_DIFF_COMMAND: CommandModule = {
  command: 'diff',
  describe: 'Analytics comparison operations',
  builder: (yargs: Argv) =>
    yargs
      .command(diffSchemaCommand)
      .demandCommand(1)
      .example([
        ['$0 analytics diff schema WS VIEW -f rows.csv', 'Report what an import of the file would drop, leave empty, or mangle'],
        ['$0 analytics diff schema WS VIEW -f rows.csv --strict', 'Also fail on a nullable column the file omits'],
        ['$0 analytics diff schema WS VIEW -f rows.csv --quiet && zoho-cli analytics import data WS VIEW -f rows.csv', 'Gate an import on a clean diff']
      ]),
  handler: noop
};
