import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';

const threadsListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List threads on a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('include', { type: 'string', describe: 'Comma-separated includes' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketThreads({ ticketId: argv.ticketId, from: argv.from, limit: argv.limit, include: argv.include });
      outputResult(result.data, { from: argv.from, limit: argv.limit, count: result.data?.length });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const threadsGetCommand: CommandModule = {
  command: 'get <ticketId> <threadId>',
  describe: 'Get a thread by ID',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).positional('threadId', { type: 'string', demandOption: true, describe: 'Thread ID' }).option('include', { type: 'string', describe: 'Comma-separated includes' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketThreadById({ ticketId: argv.ticketId, threadId: argv.threadId, include: argv.include });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskThreadsCommand: CommandModule = {
  command: 'threads',
  describe: 'Desk ticket thread operations',
  builder: (yargs: Argv) => yargs.command(threadsListCommand).command(threadsGetCommand).demandCommand(1),
  handler: noop
};
