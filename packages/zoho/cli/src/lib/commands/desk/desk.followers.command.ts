import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';

const followersListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List followers of a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketFollowers({ ticketId: argv.ticketId });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const followersAddCommand: CommandModule = {
  command: 'add <ticketId>',
  describe: 'Add followers to a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('agent-ids', { type: 'string', demandOption: true, describe: 'Comma-separated agent IDs' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const agentIds = (argv.agentIds as string).split(',').map((id: string) => id.trim());
      await api.addTicketFollowers({ ticketId: argv.ticketId, agentIds });
      outputResult({ added: true });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const followersRemoveCommand: CommandModule = {
  command: 'remove <ticketId>',
  describe: 'Remove followers from a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('agent-ids', { type: 'string', demandOption: true, describe: 'Comma-separated agent IDs' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const agentIds = (argv.agentIds as string).split(',').map((id: string) => id.trim());
      await api.removeTicketFollowers({ ticketId: argv.ticketId, agentIds });
      outputResult({ removed: true });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskFollowersCommand: CommandModule = {
  command: 'followers',
  describe: 'Desk ticket follower operations',
  builder: (yargs: Argv) => yargs.command(followersListCommand).command(followersAddCommand).command(followersRemoveCommand).demandCommand(1),
  handler: noop
};
