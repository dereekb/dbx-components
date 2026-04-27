import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, zohoDeskPaginationAdapter } from '../../util/pagination';

const timeTimerCommand: CommandModule = {
  command: 'timer <ticketId>',
  describe: 'Get current timer state for a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketTimer({ ticketId: argv.ticketId });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const timeTimerActionCommand: CommandModule = {
  command: 'timer-action <ticketId>',
  describe: 'Start, pause, resume, or stop a timer',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('action', { type: 'string', demandOption: true, choices: ['start', 'pause', 'resume', 'stop'] as const, describe: 'Timer action' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.performTicketTimerAction({ ticketId: argv.ticketId, timerAction: argv.action });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const timeEntriesCommand: CommandModule = {
  command: 'entries <ticketId>',
  describe: 'List time entries for a ticket',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const initialInput = { ticketId: argv.ticketId, from: argv.from, limit: argv.limit };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => api.getTicketTimeEntries(input),
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

const timeSummationCommand: CommandModule = {
  command: 'summation <ticketId>',
  describe: 'Get time entry summation for a ticket',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketTimeEntrySummation({ ticketId: argv.ticketId });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskTimeCommand: CommandModule = {
  command: 'time',
  describe: 'Desk time tracking operations',
  builder: (yargs: Argv) => yargs.command(timeTimerCommand).command(timeTimerActionCommand).command(timeEntriesCommand).command(timeSummationCommand).demandCommand(1),
  handler: noop
};
