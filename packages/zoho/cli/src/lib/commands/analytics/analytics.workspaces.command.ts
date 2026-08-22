import type { CommandModule, Argv } from 'yargs';
import { type Maybe, noop } from '@dereekb/util';
import { type ZohoAnalyticsWorkspaceId } from '@dereekb/zoho';
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

/**
 * Enforces that a workspace delete was confirmed by repeating the workspace id.
 *
 * Deleting a workspace destroys every table, report and dashboard in it and cannot be undone, and
 * the command's only argument is an opaque numeric id — nothing about a mistyped one looks wrong.
 * Requiring the id a second time is the guard: it costs a copy-paste and makes the target
 * impossible to hit by accident.
 *
 * @param workspaceId - Workspace id given as the positional argument.
 * @param confirm - Raw `--confirm` value, if any.
 * @returns The confirmed workspace id.
 * @throws {Error} When `--confirm` is missing or names a different workspace.
 */
export function confirmedDeleteWorkspaceId(workspaceId: ZohoAnalyticsWorkspaceId, confirm: Maybe<string>): ZohoAnalyticsWorkspaceId {
  if (!confirm) {
    throw new Error(`Deleting a workspace cannot be undone. Re-run with --confirm ${workspaceId} to proceed.`);
  }

  if (confirm !== workspaceId) {
    throw new Error(`--confirm ${confirm} does not match the workspace being deleted (${workspaceId}).`);
  }

  return workspaceId;
}

const workspacesDeleteCommand: CommandModule = {
  command: 'delete <workspaceId>',
  describe: 'Delete a workspace and everything in it. This cannot be undone',
  builder: (yargs: Argv) => yargs.positional('workspaceId', { type: 'string', demandOption: true, describe: 'Workspace ID' }).option('confirm', { type: 'string', describe: 'Repeat the workspace ID to confirm. Required' }),
  handler: async (argv: any) => {
    try {
      const workspaceId = confirmedDeleteWorkspaceId(argv.workspaceId, argv.confirm);
      const api = getAnalyticsApi(argv);
      await api.deleteWorkspace({ workspaceId });
      // a successful delete is a 204 with no body, so there is nothing to echo back but the target
      outputResult({ deleted: true, workspaceId });
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
      .command(workspacesDeleteCommand)
      .demandCommand(1)
      .example([
        ['$0 analytics workspaces list', 'List owned and shared workspaces'],
        ['$0 analytics workspaces list --owned', 'List only owned workspaces'],
        ['$0 analytics workspaces delete 1767024000000060001 --confirm 1767024000000060001', 'Delete a workspace, confirming the id']
      ]),
  handler: noop
};
