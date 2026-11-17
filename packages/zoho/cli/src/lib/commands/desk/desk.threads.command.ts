import type { CommandModule, Argv } from 'yargs';
import { getDeskContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { noop } from '@dereekb/util';
import { outputResult } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, ZOHO_DESK_PAGINATION_ADAPTER } from '../../util/pagination';
import { zohoDeskGetTicketThreadById, zohoDeskGetTicketThreads } from '@dereekb/zoho';

const threadsListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List threads on a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('include', { type: 'string', describe: 'Comma-separated includes' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const initialInput = { ticketId: argv.ticketId, from: argv.from, limit: argv.limit, include: argv.include };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => zohoDeskGetTicketThreads(deskContext)(input),
        adapter: ZOHO_DESK_PAGINATION_ADAPTER,
        multiplePages: argv.multiplePages,
        multiplePagesOutput: argv.multiplePagesOutput,
        dumpOutput: argv.dumpOutput,
        dumpMerge: argv.dumpMerge
      });
      if (outcome.handled === false) {
        const result = outcome.result;
        outputResult(result.data, { from: argv.from, limit: argv.limit, count: result.data?.length });
      }
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const threadsGetCommand: CommandModule = {
  command: 'get <ticketId> <threadId>',
  describe: 'Get a thread by ID',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).positional('threadId', { type: 'string', demandOption: true, describe: 'Thread ID' }).option('include', { type: 'string', describe: 'Comma-separated includes' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const result = await zohoDeskGetTicketThreadById(deskContext)({ ticketId: argv.ticketId, threadId: argv.threadId, include: argv.include });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const DESK_THREADS_COMMAND: CommandModule = {
  command: 'threads',
  describe: 'Desk ticket thread operations',
  builder: (yargs: Argv) => yargs.command(threadsListCommand).command(threadsGetCommand).demandCommand(1),
  handler: noop
};
