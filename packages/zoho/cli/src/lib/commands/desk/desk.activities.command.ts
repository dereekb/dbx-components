import type { CommandModule, Argv } from 'yargs';
import { getDeskContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { noop } from '@dereekb/util';
import { outputResult } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, ZOHO_DESK_PAGINATION_ADAPTER } from '../../util/pagination';
import { zohoDeskGetTicketActivities } from '@dereekb/zoho';

const activitiesListCommand: CommandModule = {
  command: 'list <ticketId>',
  describe: 'List activities on a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const initialInput = { ticketId: argv.ticketId, from: argv.from, limit: argv.limit };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => zohoDeskGetTicketActivities(deskContext)(input),
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

export const DESK_ACTIVITIES_COMMAND: CommandModule = {
  command: 'activities',
  describe: 'Desk ticket activity operations',
  builder: (yargs: Argv) => yargs.command(activitiesListCommand).demandCommand(1),
  handler: noop
};
