import { CliError } from '@dereekb/dbx-cli';
import {
  type MicrosoftGraphContext,
  type MicrosoftGraphCreateEventInput,
  type MicrosoftGraphEvent,
  type MicrosoftGraphRequestInput,
  MICROSOFT_GRAPH_EVENT_ORGANIZER_SELECT,
  createEvent,
  getEvent,
  listCalendarView,
  microsoftGraphCalendarViewRequest,
  microsoftGraphCancelEventRequest,
  microsoftGraphCreateEventRequest,
  microsoftGraphDeleteEventRequest,
  microsoftGraphEventCancellationRecipientCount,
  microsoftGraphGetEventRequest,
  microsoftGraphRequest,
  microsoftGraphRequestAllPages
} from '@dereekb/microsoft';
import { MS_IN_DAY, type Maybe } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { parseMsGraphCliDateTimeTimeZoneOption, parseMsGraphCliEnumOption } from '../util/auto.reply';
import { msGraphCliPagingOptions } from '../util/option';
import { msGraphCliConfirmOptions, msGraphCliDryRunOptions, msGraphCliDryRunOutput, parseMsGraphCliAddressesOption, readMsGraphCliBodyOption, requireMsGraphCliConfirmation } from '../util/mail.write';
import { outputMsGraphCliResult } from '../util/output';

/**
 * How far past `--start` `calendar list` reads when `--end` is not set.
 */
export const DEFAULT_MSGRAPH_CLI_CALENDAR_DAYS = 7;

const SHOW_AS_VALUES = ['free', 'tentative', 'busy', 'oof', 'workingElsewhere'] as const;

function timeZoneOption<T>(yargs: Argv<T>) {
  return yargs.option('tz', { type: 'string', describe: 'Return event times in this time zone (Prefer: outlook.timezone), e.g. "Pacific Standard Time". Default: UTC' });
}

const CALENDAR_LIST_COMMAND: CommandModule = {
  command: 'list',
  describe: 'List calendar events between two times (Graph calendarView)',
  builder: (yargs: Argv) =>
    msGraphCliPagingOptions(timeZoneOption(yargs))
      .option('start', { type: 'string', describe: 'Start, as an ISO 8601 date/time (default: now)' })
      .option('end', { type: 'string', describe: `End, as an ISO 8601 date/time (default: start + ${DEFAULT_MSGRAPH_CLI_CALENDAR_DAYS} days)` })
      .option('top', { type: 'number', describe: 'Events per page (default 50)' })
      .option('select', { type: 'string', describe: 'Fields to return, comma-separated (replaces the default set)' })
      .example([['$0 calendar list --start 2026-11-16 --end 2026-11-21 --all-pages', 'Every event of one week']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const start = argv.start ? new Date(argv.start) : new Date();
    const end = argv.end ? new Date(argv.end) : new Date(start.getTime() + DEFAULT_MSGRAPH_CLI_CALENDAR_DAYS * MS_IN_DAY);
    const input = { start: start.toISOString(), end: end.toISOString(), top: argv.top, select: argv.select, timeZone: argv.tz };

    if (argv.allPages) {
      outputMsGraphCliResult(await microsoftGraphRequestAllPages(graphContext)({ ...microsoftGraphCalendarViewRequest(input), maxPages: argv.maxPages }));
    } else {
      outputMsGraphCliResult(await listCalendarView(graphContext)(input));
    }
  })
};

const CALENDAR_GET_COMMAND: CommandModule = {
  command: 'get <id>',
  describe: 'Read one event',
  builder: (yargs: Argv) => timeZoneOption(yargs).positional('id', { type: 'string', describe: 'The event id' }).option('select', { type: 'string', describe: 'Fields to return, comma-separated (default: all)' }),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    outputMsGraphCliResult(await getEvent(graphContext)({ id: String(argv.id), select: argv.select, timeZone: argv.tz }));
  })
};

/**
 * Builds the event `calendar create` posts from its options.
 *
 * @param argv - The parsed options.
 * @returns The event input.
 * @throws {CliError} `INVALID_ARGUMENT` when the subject, start or end is missing or invalid.
 */
export async function msGraphCliCreateEventInput(argv: any): Promise<MicrosoftGraphCreateEventInput> {
  const start = parseMsGraphCliDateTimeTimeZoneOption('start', argv.start, argv.eventTz);
  const end = parseMsGraphCliDateTimeTimeZoneOption('end', argv.end, argv.eventTz);

  if (!argv.subject || !start || !end) {
    throw new CliError({ message: 'calendar create needs --subject, --start and --end.', code: 'INVALID_ARGUMENT' });
  }

  return {
    subject: String(argv.subject),
    start,
    end,
    attendees: parseMsGraphCliAddressesOption('attendee', argv.attendee),
    location: argv.location,
    body: await readMsGraphCliBodyOption({ body: argv.body, bodyFile: argv.bodyFile, html: argv.html }),
    onlineMeeting: argv.onlineMeeting,
    showAs: parseMsGraphCliEnumOption('show-as', argv.showAs, SHOW_AS_VALUES),
    reminder: argv.reminder,
    timeZone: argv.tz
  };
}

/**
 * What `calendar create` prints: the event without its attendee addresses.
 */
export interface MsGraphCliCreateEventOutput {
  readonly id: string;
  readonly webLink?: Maybe<string>;
  readonly invitationsSent: number;
}

export const CALENDAR_CREATE_COMMAND: CommandModule = {
  command: 'create',
  describe: 'Create an event. With --attendee, every attendee gets an invitation, so it needs --yes',
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(msGraphCliDryRunOptions(timeZoneOption(yargs)), 'Confirm the invitations: attendees are sent one as soon as the event is created')
      .option('subject', { type: 'string', describe: 'The subject' })
      .option('start', { type: 'string', describe: 'Start: an ISO 8601 instant, or a local date-time with --event-tz' })
      .option('end', { type: 'string', describe: 'End: an ISO 8601 instant, or a local date-time with --event-tz' })
      .option('event-tz', { type: 'string', describe: 'The time zone --start and --end are in, e.g. "Pacific Standard Time" (default: they are instants, sent as UTC)' })
      .option('attendee', { type: 'string', array: true, describe: 'Required attendee addresses (repeat, or comma-separated). Each is sent an invitation' })
      .option('location', { type: 'string', describe: 'The location name' })
      .option('body', { type: 'string', describe: 'The event description' })
      .option('body-file', { type: 'string', describe: 'Read the description from a file (.html / .htm as HTML)' })
      .option('html', { type: 'boolean', default: false, describe: 'Send --body as HTML' })
      .option('online-meeting', { type: 'boolean', default: false, describe: 'Add a Teams meeting link' })
      .option('show-as', { type: 'string', describe: `${SHOW_AS_VALUES.join(' | ')} (default: busy)` })
      .option('reminder', { type: 'boolean', describe: 'Remind before the event (--no-reminder to turn it off)' })
      .example([
        ['$0 calendar create --subject Focus --start 2026-11-16T09:00 --end 2026-11-16T11:00 --event-tz "Pacific Standard Time" --show-as busy', 'Block two hours; no attendees, so no --yes'],
        ['$0 calendar create --subject Sync --start 2026-11-16T17:00Z --end 2026-11-16T17:30Z --attendee ada@example.com --online-meeting --yes', 'A Teams meeting with one invitee']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const input = await msGraphCliCreateEventInput(argv);
    const attendees = input.attendees?.length ?? 0;

    if (argv.dryRun) {
      outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphCreateEventRequest(input)], attendees > 0 ? `Graph sends ${attendees} invitation(s) when the event is created.` : undefined));
    } else {
      if (attendees > 0) {
        requireMsGraphCliConfirmation({ yes: argv.yes, action: `create an event and send ${attendees} invitation(s)` });
      }

      const event = await createEvent(graphContext)(input);
      const output: MsGraphCliCreateEventOutput = { id: event.id, webLink: event.webLink, invitationsSent: attendees };
      outputMsGraphCliResult(output);
    }
  })
};

/**
 * What `calendar delete` prints.
 */
export interface MsGraphCliDeleteEventOutput {
  readonly id: string;
  readonly deleted?: true;
  readonly cancelled?: true;
  /**
   * How many attendees Outlook sent a cancellation.
   */
  readonly cancellationsSent: number;
}

/**
 * Deletes or cancels an event after reading whether the user organizes it, refusing without `--yes`.
 *
 * @param input - The Graph context, event id, `--cancel`, `--comment` and `--yes`.
 * @param input.graphContext - The Graph context.
 * @param input.id - The event id.
 * @param input.cancel - Whether to cancel (`/cancel`) instead of deleting.
 * @param input.comment - The cancellation comment.
 * @param input.yes - Whether `--yes` was passed.
 * @returns What the command prints.
 * @throws {CliError} `CONFIRMATION_REQUIRED` without `--yes`; `INVALID_ARGUMENT` when cancelling an event the user does not organize.
 */
export async function deleteMsGraphCliEvent(input: { readonly graphContext: MicrosoftGraphContext; readonly id: string; readonly cancel?: Maybe<boolean>; readonly comment?: Maybe<string>; readonly yes?: Maybe<boolean> }): Promise<MsGraphCliDeleteEventOutput> {
  const request = microsoftGraphRequest(input.graphContext);
  const event = await request<MicrosoftGraphEvent>(microsoftGraphGetEventRequest({ id: input.id, select: MICROSOFT_GRAPH_EVENT_ORGANIZER_SELECT }));
  const cancellations = microsoftGraphEventCancellationRecipientCount(event);
  let output: MsGraphCliDeleteEventOutput;

  if (input.cancel) {
    if (!event.isOrganizer) {
      throw new CliError({ message: 'Only the organizer can cancel a meeting.', code: 'INVALID_ARGUMENT', suggestion: 'Drop --cancel to remove the event from your own calendar; the organizer is not notified.' });
    }

    requireMsGraphCliConfirmation({ yes: input.yes, action: `cancel the meeting and send ${cancellations} attendee(s) a cancellation` });
    await request(microsoftGraphCancelEventRequest({ id: input.id, comment: input.comment }));
    output = { id: input.id, cancelled: true, cancellationsSent: cancellations };
  } else {
    requireMsGraphCliConfirmation({ yes: input.yes, action: cancellations > 0 ? `delete a meeting you organize: its ${cancellations} attendee(s) are sent a cancellation` : 'delete the event' });
    await request(microsoftGraphDeleteEventRequest(input.id));
    output = { id: input.id, deleted: true, cancellationsSent: cancellations };
  }

  return output;
}

export const CALENDAR_DELETE_COMMAND: CommandModule = {
  command: 'delete <id>',
  describe: 'Delete an event. On a meeting you organize, attendees are sent cancellations (--cancel --comment adds a message). Needs --yes',
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(msGraphCliDryRunOptions(yargs), 'Confirm the delete: on a meeting you organize, attendees are sent cancellations')
      .positional('id', { type: 'string', describe: 'The event id' })
      .option('cancel', { type: 'boolean', default: false, describe: 'Cancel the meeting (organizer only) through /cancel, sending --comment with the cancellation' })
      .option('comment', { type: 'string', describe: 'With --cancel: the message sent to attendees' })
      .example([['$0 calendar delete AAMk... --cancel --comment "Moving to next week" --yes', 'Cancel a meeting you organize']]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const id = String(argv.id);

    if (argv.dryRun) {
      const action: MicrosoftGraphRequestInput = argv.cancel ? microsoftGraphCancelEventRequest({ id, comment: argv.comment }) : microsoftGraphDeleteEventRequest(id);
      outputMsGraphCliResult(msGraphCliDryRunOutput([microsoftGraphGetEventRequest({ id, select: MICROSOFT_GRAPH_EVENT_ORGANIZER_SELECT }), action], 'The GET decides whether attendees get cancellations: they do when you organize the event.'));
    } else {
      outputMsGraphCliResult(await deleteMsGraphCliEvent({ graphContext, id, cancel: argv.cancel, comment: argv.comment, yes: argv.yes }));
    }
  })
};

/**
 * The `calendar` command: `list`, `get`, `create`, `delete`.
 */
export const CALENDAR_COMMAND: CommandModule = {
  command: 'calendar',
  describe: "Read and write the user's Outlook calendar",
  builder: (yargs: Argv) => yargs.command(CALENDAR_LIST_COMMAND).command(CALENDAR_GET_COMMAND).command(CALENDAR_CREATE_COMMAND).command(CALENDAR_DELETE_COMMAND).demandCommand(1, 'Please specify a calendar subcommand.'),
  handler: () => undefined
};
