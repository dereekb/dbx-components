import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { getAnalyticsApi } from '../../middleware/auth.middleware';
import { outputResult, outputError } from '../../util/output';

const viewsListCommand: CommandModule = {
  command: 'list <workspaceId>',
  describe: 'List the views of a workspace',
  builder: (yargs: Argv) => yargs.positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const result = await api.getViews({ workspaceId: argv.workspaceId });
      outputResult(result.data.views, { count: result.data.views?.length });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const viewsGetCommand: CommandModule = {
  command: 'get <viewId>',
  describe: 'Get a view by ID',
  builder: (yargs: Argv) => yargs.positional('viewId', { type: 'string', demandOption: true, describe: 'View ID (globally unique, no workspace needed)' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const result = await api.getViewDetails({ viewId: argv.viewId });
      outputResult(result.data.views);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const viewsColumnsCommand: CommandModule = {
  command: 'columns <workspaceId> <viewId>',
  describe: 'List the columns of a table',
  builder: (yargs: Argv) => yargs.positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }).positional('viewId', { type: 'string', demandOption: true, describe: 'View ID' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const result = await api.getTableMetadata({ workspaceId: argv.workspaceId, viewId: argv.viewId });
      outputResult(result.data.columns, { count: result.data.columns?.length });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const ANALYTICS_VIEWS_COMMAND: CommandModule = {
  command: 'views',
  describe: 'Analytics view operations',
  builder: (yargs: Argv) =>
    yargs
      .command(viewsListCommand)
      .command(viewsGetCommand)
      .command(viewsColumnsCommand)
      .demandCommand(1)
      .example([
        ['$0 analytics views list 1767024000000060001', 'List the views of a workspace'],
        ['$0 analytics views columns 1767024000000060001 1767024000000149001', 'Inspect a table before importing into it']
      ]),
  handler: noop
};
