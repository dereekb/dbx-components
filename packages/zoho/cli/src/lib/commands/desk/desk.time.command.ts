import type { CommandModule, Argv } from 'yargs';
import { getDeskContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { noop } from '@dereekb/util';
import { outputResult } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, ZOHO_DESK_PAGINATION_ADAPTER } from '../../util/pagination';
import { zohoDeskGetTicketTimeEntries, zohoDeskGetTicketTimeEntrySummation, zohoDeskGetTicketTimer, zohoDeskPerformTicketTimerAction } from '@dereekb/zoho';

const timeTimerCommand: CommandModule = {
  command: 'timer <ticketId>',
  describe: 'Get current timer state for a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const result = await zohoDeskGetTicketTimer(deskContext)({ ticketId: argv.ticketId });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const timeTimerActionCommand: CommandModule = {
  command: 'timer-action <ticketId>',
  describe: 'Start, pause, resume, or stop a timer',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('action', { type: 'string', demandOption: true, choices: ['start', 'pause', 'resume', 'stop'] as const, describe: 'Timer action' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const result = await zohoDeskPerformTicketTimerAction(deskContext)({ ticketId: argv.ticketId, timerAction: argv.action });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const timeEntriesCommand: CommandModule = {
  command: 'entries <ticketId>',
  describe: 'List time entries for a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const initialInput = { ticketId: argv.ticketId, from: argv.from, limit: argv.limit };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => zohoDeskGetTicketTimeEntries(deskContext)(input),
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

const timeSummationCommand: CommandModule = {
  command: 'summation <ticketId>',
  describe: 'Get time entry summation for a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const result = await zohoDeskGetTicketTimeEntrySummation(deskContext)({ ticketId: argv.ticketId });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const DESK_TIME_COMMAND: CommandModule = {
  command: 'time',
  describe: 'Desk time tracking operations',
  builder: (yargs: Argv) => yargs.command(timeTimerCommand).command(timeTimerActionCommand).command(timeEntriesCommand).command(timeSummationCommand).demandCommand(1),
  handler: noop
};
