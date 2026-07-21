import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { getSignApi } from '../../middleware/auth.middleware';
import { outputResult, outputError } from '../../util/output';
import { withSignPagination } from '../../util/args';
import { runZohoSignPaginatedList } from '../../util/pagination';

/**
 * Builds the optional `search_columns` filter for the templates list, returning `undefined` when no
 * filters were supplied so the request omits the filter entirely.
 *
 * @param argv - The yargs-parsed arguments carrying the per-column filter values.
 * @returns A populated search-columns map, or `undefined` when no filters were supplied.
 */
function buildSearchColumns(argv: any): Record<string, string> | undefined {
  const columns: Record<string, string> = {};

  if (argv.templateName) columns['template_name'] = argv.templateName;
  if (argv.ownerFullName) columns['owner_full_name'] = argv.ownerFullName;

  return Object.keys(columns).length > 0 ? columns : undefined;
}

const templatesListCommand: CommandModule = {
  command: 'list',
  describe: 'List templates',
  builder: (yargs: Argv) =>
    withSignPagination(yargs)
      .option('sort-column', { type: 'string', describe: 'Column to sort by (e.g. template_name, created_time)' })
      .option('sort-order', { type: 'string', choices: ['ASC', 'DESC'] as const, describe: 'Sort direction' })
      .option('template-name', { type: 'string', describe: 'Filter by template name' })
      .option('owner-full-name', { type: 'string', describe: 'Filter by owner full name' }),
  handler: async (argv: any) => {
    try {
      const signApi = getSignApi(argv);
      const initialInput = {
        start_index: argv.startIndex,
        row_count: argv.rowCount,
        sort_column: argv.sortColumn,
        sort_order: argv.sortOrder,
        search_columns: buildSearchColumns(argv)
      };
      await runZohoSignPaginatedList({ argv, initialInput, fetchPage: (input) => signApi.getTemplates(input) });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const templatesGetCommand: CommandModule = {
  command: 'get <templateId>',
  describe: 'Get a template by ID',
  builder: (yargs: Argv) => yargs.positional('templateId', { type: 'string', demandOption: true, describe: 'Template ID' }),
  handler: async (argv: any) => {
    try {
      const signApi = getSignApi(argv);
      const result = await signApi.getTemplate({ templateId: argv.templateId });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const SIGN_TEMPLATES_COMMAND: CommandModule = {
  command: 'templates',
  describe: 'Zoho Sign template operations',
  builder: (yargs: Argv) =>
    yargs
      .command(templatesListCommand)
      .command(templatesGetCommand)
      .demandCommand(1, 'Please specify a templates subcommand.')
      .example([
        ['$0 sign templates list --row-count 10', 'List first 10 templates'],
        ['$0 sign templates get 286906000001616000', 'Get a template by ID']
      ]),
  handler: noop
};
