import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { getAnalyticsApi } from '../../middleware/auth.middleware';
import { outputResult, outputError } from '../../util/output';

const workspacesListCommand: CommandModule = {
  command: 'list',
  describe: 'List all accessible workspaces',
  builder: (yargs: Argv) => yargs.option('owned', { type: 'boolean', describe: 'Only workspaces owned by the authenticated user' }).option('shared', { type: 'boolean', describe: 'Only workspaces shared with the authenticated user' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);

      if (argv.owned) {
        const result = await api.getOwnedWorkspaces();
        outputResult(result.data.workspaces, { count: result.data.workspaces?.length });
      } else if (argv.shared) {
        const result = await api.getSharedWorkspaces();
        outputResult(result.data.workspaces, { count: result.data.workspaces?.length });
      } else {
        const result = await api.getAllWorkspaces();
        outputResult(result.data);
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const workspacesGetCommand: CommandModule = {
  command: 'get <workspaceId>',
  describe: 'Get a workspace by ID',
  builder: (yargs: Argv) => yargs.positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }),
  handler: async (argv: any) => {
    try {
      const api = getAnalyticsApi(argv);
      const result = await api.getWorkspaceDetails({ workspaceId: argv.workspaceId });
      outputResult(result.data.workspaces);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const ANALYTICS_WORKSPACES_COMMAND: CommandModule = {
  command: 'workspaces',
  describe: 'Analytics workspace operations',
  builder: (yargs: Argv) =>
    yargs
      .command(workspacesListCommand)
      .command(workspacesGetCommand)
      .demandCommand(1)
      .example([
        ['$0 analytics workspaces list', 'List owned and shared workspaces'],
        ['$0 analytics workspaces list --owned', 'List only owned workspaces']
      ]),
  handler: noop
};
