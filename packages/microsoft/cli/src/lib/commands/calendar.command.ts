import { outputMsGraphCliResult } from '../util/output';
import { listCalendarView } from '@dereekb/microsoft';
import { MS_IN_DAY } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCommandHandler } from '../middleware/auth.middleware';

/**
 * How far past `--start` `calendar list` reads when `--end` is not set.
 */
export const DEFAULT_MSGRAPH_CLI_CALENDAR_DAYS = 7;

const CALENDAR_LIST_COMMAND: CommandModule = {
  command: 'list',
  describe: 'List calendar events between two times (Graph calendarView)',
  builder: (yargs: Argv) =>
    yargs
      .option('start', { type: 'string', describe: 'Start, as an ISO 8601 date/time (default: now)' })
      .option('end', { type: 'string', describe: `End, as an ISO 8601 date/time (default: start + ${DEFAULT_MSGRAPH_CLI_CALENDAR_DAYS} days)` })
      .option('top', { type: 'number', describe: 'Maximum events to return (default 50)' })
      .example([['$0 calendar list --start 2026-11-16 --end 2026-11-21', 'The events of one week']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const start = argv.start ? new Date(argv.start) : new Date();
    const end = argv.end ? new Date(argv.end) : new Date(start.getTime() + DEFAULT_MSGRAPH_CLI_CALENDAR_DAYS * MS_IN_DAY);
    outputMsGraphCliResult(await listCalendarView(graphContext)({ start: start.toISOString(), end: end.toISOString(), top: argv.top }));
  })
};

/**
 * The `calendar` command: `calendar list`.
 */
export const CALENDAR_COMMAND: CommandModule = {
  command: 'calendar',
  describe: "Read the user's Outlook calendar",
  builder: (yargs: Argv) => yargs.command(CALENDAR_LIST_COMMAND).demandCommand(1, 'Please specify a calendar subcommand.'),
  handler: () => undefined
};
