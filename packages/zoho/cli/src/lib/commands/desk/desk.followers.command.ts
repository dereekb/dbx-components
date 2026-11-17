import type { CommandModule, Argv } from 'yargs';
import { getDeskContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { noop } from '@dereekb/util';
import { outputResult } from '../../util/output';
import { zohoDeskAddTicketFollowers, zohoDeskGetTicketFollowers, zohoDeskRemoveTicketFollowers } from '@dereekb/zoho';

const followersListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List followers of a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const result = await zohoDeskGetTicketFollowers(deskContext)({ ticketId: argv.ticketId });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const followersAddCommand: CommandModule = {
  command: 'add <ticketId>',
  describe: 'Add followers to a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('agent-ids', { type: 'string', demandOption: true, describe: 'Comma-separated agent IDs' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const agentIds = (argv.agentIds as string).split(',').map((id: string) => id.trim());
      await zohoDeskAddTicketFollowers(deskContext)({ ticketId: argv.ticketId, agentIds });
      outputResult({ added: true });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const followersRemoveCommand: CommandModule = {
  command: 'remove <ticketId>',
  describe: 'Remove followers from a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('agent-ids', { type: 'string', demandOption: true, describe: 'Comma-separated agent IDs' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const agentIds = (argv.agentIds as string).split(',').map((id: string) => id.trim());
      await zohoDeskRemoveTicketFollowers(deskContext)({ ticketId: argv.ticketId, agentIds });
      outputResult({ removed: true });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const DESK_FOLLOWERS_COMMAND: CommandModule = {
  command: 'followers',
  describe: 'Desk ticket follower operations',
  builder: (yargs: Argv) => yargs.command(followersListCommand).command(followersAddCommand).command(followersRemoveCommand).demandCommand(1),
  handler: noop
};
