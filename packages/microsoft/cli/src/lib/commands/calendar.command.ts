import { CliError } from '@dereekb/dbx-cli';
import {
  type MicrosoftGraphContext,
  type MicrosoftGraphCreateEventInput,
  type MicrosoftGraphDateTimeTimeZone,
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
  microsoftGraphGetMailboxTimeZoneRequest,
  microsoftGraphRequest,
  microsoftGraphRequestAllPages
} from '@dereekb/microsoft';
import { MS_IN_DAY, MS_IN_MINUTE, type Maybe, type Minutes } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCommandHandler } from '../middleware/auth.middleware';
import { MSGRAPH_CLI_LOCAL_DATE_ONLY_PATTERN, MSGRAPH_CLI_LOCAL_DATE_TIME_PATTERN, isMsGraphCliZonelessDateTime, parseMsGraphCliDateTimeTimeZoneOption, parseMsGraphCliEnumOption, readMsGraphCliMailboxTimeZone } from '../util/auto.reply';
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
 * Returns whether `calendar create` needs a time zone it was not given: `--all-day`, or a zone-less `--start` /
 * `--end`. The command then reads the mailbox's time zone, so `15:00` means 3 pm where the user's Outlook calendar
 * is, not where the CLI runs (a cloud sandbox runs in UTC).
 *
 * @param argv - The parsed options.
 * @returns True when the event's time zone must be resolved.
 */
export function isMsGraphCliEventTimeZoneNeeded(argv: any): boolean {
  return !argv.eventTz && (argv.allDay === true || isMsGraphCliZonelessDateTime(argv.start) || isMsGraphCliZonelessDateTime(argv.end));
}

/**
 * Parses a `--duration`: minutes (`45`), or hours and minutes (`1h`, `90m`, `1h30m`).
 *
 * @param value - The option value.
 * @returns The minutes, or undefined when the option is not set.
 * @throws {CliError} `INVALID_ARGUMENT` when the value does not parse or is not positive.
 */
export function parseMsGraphCliDurationOption(value: unknown): Maybe<Minutes> {
  let result: Maybe<Minutes>;

  if (value != null && value !== '') {
    const text = String(value).trim().toLowerCase();
    const match = /^(?:(\d+)h)?(?:(\d+)m)?$/.exec(text);

    if (/^\d+$/.test(text)) {
      result = Number(text);
    } else if (match && (match[1] != null || match[2] != null)) {
      result = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
    }

    if (!result || result <= 0) {
      throw new CliError({ message: `--duration "${String(value)}" is not a duration.`, code: 'INVALID_ARGUMENT', suggestion: 'Use minutes or hours and minutes, e.g. --duration 30, --duration 1h, --duration 1h30m.' });
    }
  }

  return result;
}

function shiftLocalDateTime(text: string, minutes: Minutes): string {
  // a wall-clock value is shifted as if it were UTC, then written back without a zone
  return new Date(new Date(`${text}Z`).getTime() + minutes * MS_IN_MINUTE).toISOString().slice(0, 19);
}

/**
 * Turns one `--start` / `--end` value of a timed event into a Graph `dateTimeTimeZone`: a zone-less value is a
 * wall-clock time in `timeZone`; a value with `Z` or an offset is an instant, sent as UTC.
 *
 * @param name - The option name, for the error.
 * @param value - The option value.
 * @param timeZone - The event's time zone.
 * @returns The date-time and zone, or undefined when the option is not set.
 * @throws {CliError} `INVALID_ARGUMENT` for a date with no time, or a value that does not parse.
 */
export function parseMsGraphCliEventTimeOption(name: string, value: unknown, timeZone: Maybe<string>): Maybe<MicrosoftGraphDateTimeTimeZone> {
  let result: Maybe<MicrosoftGraphDateTimeTimeZone>;

  if (value != null && value !== '') {
    const text = String(value);

    if (MSGRAPH_CLI_LOCAL_DATE_ONLY_PATTERN.test(text)) {
      throw new CliError({ message: `--${name} "${text}" is a date with no time.`, code: 'INVALID_ARGUMENT', suggestion: `Add a time (--${name} ${text}T09:00), or pass --all-day for a whole-day event.` });
    } else if (MSGRAPH_CLI_LOCAL_DATE_TIME_PATTERN.test(text)) {
      if (!timeZone) {
        throw new CliError({ message: `--${name} "${text}" has no time zone.`, code: 'INVALID_ARGUMENT', suggestion: 'Pass --event-tz "<zone>", or an instant with an offset (2026-11-20T15:00-08:00).' });
      }

      result = { dateTime: text, timeZone };
    } else {
      result = parseMsGraphCliDateTimeTimeZoneOption(name, text);
    }
  }

  return result;
}

/**
 * Builds the start and end of an all-day event: midnights in `timeZone`, from `--start` (the first day) to the
 * day after `--end` (the last day, inclusive; default: the first day).
 *
 * @param argv - The parsed options.
 * @param timeZone - The event's time zone.
 * @returns The start and end.
 * @throws {CliError} `INVALID_ARGUMENT` when a day is not a date, the last day is before the first, or `--duration` is set.
 */
function msGraphCliAllDayEventRange(argv: any, timeZone: string): { readonly start: MicrosoftGraphDateTimeTimeZone; readonly end: MicrosoftGraphDateTimeTimeZone } {
  const first = String(argv.start ?? '');
  const last = argv.end == null || argv.end === '' ? first : String(argv.end);

  if (!MSGRAPH_CLI_LOCAL_DATE_ONLY_PATTERN.test(first) || !MSGRAPH_CLI_LOCAL_DATE_ONLY_PATTERN.test(last)) {
    throw new CliError({ message: '--all-day takes dates: --start <first day> [--end <last day>], e.g. --start 2026-11-20 --end 2026-11-21.', code: 'INVALID_ARGUMENT' });
  } else if (argv.duration != null) {
    throw new CliError({ message: '--all-day does not take --duration; use --end <last day>.', code: 'INVALID_ARGUMENT' });
  } else if (last < first) {
    throw new CliError({ message: `--end ${last} is before --start ${first}.`, code: 'INVALID_ARGUMENT' });
  }

  const dayAfterLast = shiftLocalDateTime(`${last}T00:00:00`, 24 * 60).slice(0, 10);
  return { start: { dateTime: `${first}T00:00:00`, timeZone }, end: { dateTime: `${dayAfterLast}T00:00:00`, timeZone } };
}

/**
 * Builds the event `calendar create` posts from its options. A zone-less `--start` / `--end` and an all-day
 * event's days are read in `--event-tz`; the handler fills it with the mailbox's time zone when it is not given.
 *
 * @param argv - The parsed options.
 * @returns The event input.
 * @throws {CliError} `INVALID_ARGUMENT` when the subject, start or end is missing or invalid.
 */
export async function msGraphCliCreateEventInput(argv: any): Promise<MicrosoftGraphCreateEventInput> {
  const timeZone: Maybe<string> = argv.eventTz;
  const duration = parseMsGraphCliDurationOption(argv.duration);
  let start: Maybe<MicrosoftGraphDateTimeTimeZone>;
  let end: Maybe<MicrosoftGraphDateTimeTimeZone>;

  if (!argv.subject) {
    throw new CliError({ message: 'calendar create needs --subject.', code: 'INVALID_ARGUMENT' });
  }

  if (argv.allDay) {
    if (!timeZone) {
      throw new CliError({ message: '--all-day needs the event time zone.', code: 'INVALID_ARGUMENT', suggestion: 'Pass --event-tz "<zone>".' });
    }

    ({ start, end } = msGraphCliAllDayEventRange(argv, timeZone));
  } else {
    if (argv.end != null && duration != null) {
      throw new CliError({ message: 'Pass --end or --duration, not both.', code: 'INVALID_ARGUMENT' });
    }

    start = parseMsGraphCliEventTimeOption('start', argv.start, timeZone);
    end = parseMsGraphCliEventTimeOption('end', argv.end, timeZone);

    if (start && !end && duration != null) {
      end = { dateTime: shiftLocalDateTime(start.dateTime, duration), timeZone: start.timeZone };
    }
  }

  if (!start || !end) {
    throw new CliError({ message: 'calendar create needs --start and --end (or --duration, or --all-day).', code: 'INVALID_ARGUMENT' });
  }

  return {
    subject: String(argv.subject),
    start,
    end,
    allDay: argv.allDay === true ? true : undefined,
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
  /**
   * The event's start and end as sent, so a caller can check the time zone it landed in.
   */
  readonly start: MicrosoftGraphDateTimeTimeZone;
  readonly end: MicrosoftGraphDateTimeTimeZone;
  readonly isAllDay?: true;
}

export const CALENDAR_CREATE_COMMAND: CommandModule = {
  command: 'create',
  describe: "Create an event on your Outlook calendar (local times are in your mailbox's time zone). With --attendee, every attendee gets an invitation, so it needs --yes",
  builder: (yargs: Argv) =>
    msGraphCliConfirmOptions(msGraphCliDryRunOptions(timeZoneOption(yargs)), 'Confirm the invitations: attendees are sent one as soon as the event is created')
      .option('subject', { type: 'string', describe: 'The subject' })
      .option('start', { type: 'string', describe: "Start: a local date-time (2026-11-20T15:00, read in --event-tz, default your mailbox's time zone) or an instant with Z / an offset. With --all-day: the first day (2026-11-20)" })
      .option('end', { type: 'string', describe: 'End, like --start. With --all-day: the last day, inclusive (default: the first day)' })
      .option('duration', { type: 'string', describe: 'Instead of --end: how long, in minutes or hours and minutes (30, 45m, 1h, 1h30m)' })
      .option('all-day', { type: 'boolean', default: false, describe: 'An all-day event: --start / --end are dates' })
      .option('event-tz', { type: 'string', describe: 'The time zone a local --start / --end is in, e.g. "Pacific Standard Time" or "America/Denver". Default: your mailbox\'s time zone (MailboxSettings.Read), never the machine\'s' })
      .option('attendee', { type: 'string', array: true, describe: 'Required attendee addresses (repeat, or comma-separated). Each is sent an invitation' })
      .option('location', { type: 'string', describe: 'The location name' })
      .option('body', { type: 'string', describe: 'The event description' })
      .option('body-file', { type: 'string', describe: 'Read the description from a file (.html / .htm as HTML)' })
      .option('html', { type: 'boolean', default: false, describe: 'Send --body as HTML' })
      .option('online-meeting', { type: 'boolean', default: false, describe: 'Add a Teams meeting link' })
      .option('show-as', { type: 'string', describe: `${SHOW_AS_VALUES.join(' | ')} (default: busy)` })
      .option('reminder', { type: 'boolean', describe: 'Remind before the event (--no-reminder to turn it off)' })
      .example([
        ['$0 calendar create --subject "Call with Ada" --start 2026-11-20T15:00 --duration 30m', "A 30-minute event at 3 pm in your mailbox's time zone; no attendees, so no --yes"],
        ['$0 calendar create --subject Focus --start 2026-11-16T09:00 --end 2026-11-16T11:00 --event-tz "Pacific Standard Time" --show-as busy', 'Block two hours in a given zone'],
        ['$0 calendar create --subject "Conference" --all-day --start 2026-12-03 --end 2026-12-04 --show-as oof', 'A two-day all-day event'],
        ['$0 calendar create --subject Sync --start 2026-11-16T17:00Z --duration 30 --attendee ada@example.com --online-meeting --yes', 'A Teams meeting with one invitee']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const zoneNeeded = isMsGraphCliEventTimeZoneNeeded(argv);
    const eventTz: Maybe<string> = zoneNeeded ? await readMsGraphCliMailboxTimeZone({ graphContext, option: 'event-tz' }) : argv.eventTz;
    const input = await msGraphCliCreateEventInput({ ...argv, eventTz });
    const attendees = input.attendees?.length ?? 0;

    if (argv.dryRun) {
      const notes = [zoneNeeded ? `The GET read the mailbox time zone (${eventTz}); local times are in it.` : undefined, attendees > 0 ? `Graph sends ${attendees} invitation(s) when the event is created.` : undefined].filter((x) => x != null);
      outputMsGraphCliResult(msGraphCliDryRunOutput([...(zoneNeeded ? [microsoftGraphGetMailboxTimeZoneRequest()] : []), microsoftGraphCreateEventRequest(input)], notes.length > 0 ? notes.join(' ') : undefined));
    } else {
      if (attendees > 0) {
        requireMsGraphCliConfirmation({ yes: argv.yes, action: `create an event and send ${attendees} invitation(s)` });
      }

      const event = await createEvent(graphContext)(input);
      const output: MsGraphCliCreateEventOutput = { id: event.id, webLink: event.webLink, invitationsSent: attendees, start: input.start, end: input.end, ...(input.allDay ? { isAllDay: true as const } : {}) };
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
