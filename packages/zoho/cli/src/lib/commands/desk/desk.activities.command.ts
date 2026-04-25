import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, zohoDeskPaginationAdapter } from '../../util/pagination';

const activitiesListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List activities on a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const initialInput = { ticketId: argv.ticketId, from: argv.from, limit: argv.limit };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => api.getTicketActivities(input as any),
        adapter: zohoDeskPaginationAdapter,
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
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskActivitiesCommand: CommandModule = {
  command: 'activities',
  describe: 'Desk ticket activity operations',
  builder: (yargs: Argv) => yargs.command(activitiesListCommand).demandCommand(1),
  handler: noop
};
