import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { getAnalyticsApi } from '../../middleware/auth.middleware';
import { outputResult, outputError } from '../../util/output';

/**
 * Adds the workspace and view positionals shared by the row commands.
 *
 * @param yargs - The yargs builder to extend.
 * @returns The builder with the shared row positionals applied.
 */
function withRowTarget(yargs: Argv): Argv {
  return yargs.positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }).positional('viewId', { type: 'string', demandOption: true, describe: 'Table view ID' });
}

const rowsAddCommand: CommandModule = {
  command: 'add <workspaceId> <viewId>',
  describe: 'Add a single row to a table',
  builder: (yargs: Argv) => withRowTarget(yargs).option('columns', { type: 'string', demandOption: true, describe: 'Row as a JSON object of column name to value' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const columns = JSON.parse(argv.columns as string);
      const result = await api.addRow({ workspaceId: argv.workspaceId, viewId: argv.viewId, config: { columns } });
      outputResult(result.data);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const rowsUpdateCommand: CommandModule = {
  command: 'update <workspaceId> <viewId>',
  describe: 'Update the rows of a table matching a criteria expression',
  builder: (yargs: Argv) =>
    withRowTarget(yargs).option('columns', { type: 'string', demandOption: true, describe: 'New values as a JSON object of column name to value' }).option('criteria', { type: 'string', describe: `Filter expression, e.g. "Sales"."Region"='West'` }).option('all-rows', { type: 'boolean', default: false, describe: 'Update every row. Required when no --criteria is given' }).option('add-if-not-exist', { type: 'boolean', default: false, describe: 'Insert a row when the criteria matches nothing' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const columns = JSON.parse(argv.columns as string);
      const result = await api.updateRows({ workspaceId: argv.workspaceId, viewId: argv.viewId, config: { columns, criteria: argv.criteria, updateAllRows: argv.allRows, addIfNotExist: argv.addIfNotExist } });
      outputResult(result.data);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const rowsDeleteCommand: CommandModule = {
  command: 'delete <workspaceId> <viewId>',
  describe: 'Delete the rows of a table matching a criteria expression',
  builder: (yargs: Argv) => withRowTarget(yargs).option('criteria', { type: 'string', describe: `Filter expression, e.g. "Sales"."Region"='West'` }).option('all-rows', { type: 'boolean', default: false, describe: 'Delete every row. Required when no --criteria is given' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const result = await api.deleteRows({ workspaceId: argv.workspaceId, viewId: argv.viewId, config: { criteria: argv.criteria, deleteAllRows: argv.allRows } });
      outputResult(result.data);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const ANALYTICS_ROWS_COMMAND: CommandModule = {
  command: 'rows',
  describe: 'Analytics row operations',
  builder: (yargs: Argv) =>
    yargs
      .command(rowsAddCommand)
      .command(rowsUpdateCommand)
      .command(rowsDeleteCommand)
      .demandCommand(1)
      .example([
        ['$0 analytics rows add WS VIEW --columns \'{"Region":"East"}\'', 'Add one row'],
        ['$0 analytics rows delete WS VIEW --criteria \'"Sales"."Region"=\'"\'"\'West\'"\'"\'\'', 'Delete the rows matching a filter']
      ]),
  handler: noop
};
