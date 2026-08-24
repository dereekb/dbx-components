import { type ISO8601DayString, type Maybe, MINUTES_IN_DAY, MS_IN_DAY, parseISO8601DayStringToUTCDate, type TimezoneString, UTC_TIMEZONE_STRING } from '@dereekb/util';
import { type CalendarDate, CalendarDateType } from '../date/date.calendar';
import { type DateDurationSpan, dateDurationSpanEndDate } from '../date/date.duration';
import { formatToISO8601DayStringForUTC } from '../date/date.format';
import { dateTimezoneUtcNormal } from '../date/date.timezone';
import { type ICalendarUid } from './icalendar';
import { type ICalendarDateOnly, type ICalendarEvent, type ICalendarUtcDateTime } from './icalendar.model';

/**
 * Configuration for {@link iCalendarUidFactory}.
 */
export interface ICalendarUidFactoryConfig {
  /**
   * The right-hand side of the generated UID, per RFC 5545 3.8.4.7's guidance that a UID be globally unique.
   * I.E. "example.com".
   */
  readonly domain: string;
  /**
   * Optional prefix placed before the key, separated by a dash. I.E. "job".
   */
  readonly prefix?: Maybe<string>;
}

/**
 * Builds a stable UID from a caller-supplied key.
 */
export type ICalendarUidFactory = (key: string) => ICalendarUid;

/**
 * Creates an {@link ICalendarUidFactory}.
 *
 * There is deliberately no random or generated fallback anywhere in this library: a UID that changes between
 * publishes makes every client create a duplicate event rather than update the one it holds, which defeats the
 * entire purpose of a UID. The key must be derived from something stable — a document id plus an instance key.
 *
 * @param config - The domain and optional prefix applied to every generated UID.
 * @returns Builds a UID from a stable key.
 *
 * @example
 * ```ts
 * iCalendarUidFactory({ domain: 'example.com', prefix: 'job' })('abc123'); // 'job-abc123@example.com'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarUidFactory(config: ICalendarUidFactoryConfig): ICalendarUidFactory {
  const { domain, prefix } = config;
  const keyPrefix = prefix ? `${prefix}-` : '';

  return (key: string) => `${keyPrefix}${key}@${domain}`;
}

/**
 * The descriptive half of an {@link ICalendarEvent}: everything except the timing, which the factory derives.
 */
export type ICalendarEventForDateDurationSpanConfig = Omit<ICalendarEvent, 'start' | 'end' | 'duration'>;

/**
 * Builds a timed {@link ICalendarEvent} from a {@link DateDurationSpan}.
 *
 * Both ends are emitted as absolute UTC instants, which every client reads identically and which needs no
 * VTIMEZONE component.
 *
 * @param span - The span the event occupies.
 * @param config - The event's UID and descriptive properties.
 * @returns The event.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarEventForDateDurationSpan(span: DateDurationSpan, config: ICalendarEventForDateDurationSpanConfig): ICalendarEvent {
  const start: ICalendarUtcDateTime = { type: 'utc', at: span.startsAt };
  const end: ICalendarUtcDateTime = { type: 'utc', at: dateDurationSpanEndDate(span) };

  return { ...config, start, end };
}

/**
 * Configuration for {@link iCalendarEventForCalendarDate}.
 */
export interface ICalendarEventForCalendarDateConfig extends ICalendarEventForDateDurationSpanConfig {
  /**
   * REQUIRED for a {@link CalendarDateType.DAYS} input: the timezone the CalendarDate was created in.
   * Pass `false` when it was created in UTC.
   *
   * A CalendarDate stores its `startsAt` as the real instant of local midnight in its originating zone, so
   * the calendar day cannot be recovered without knowing that zone. Defaulting to the system zone here would
   * make the emitted day depend on where the serializer happens to run, which is the classic all-day bug.
   *
   * Unused for a {@link CalendarDateType.TIME} input.
   */
  readonly timezone: TimezoneString | false;
}

/**
 * Adds a number of days to an ISO 8601 day string without ever leaving UTC.
 *
 * The arithmetic is done on the epoch value rather than through date-fns' addDays(), which preserves the
 * LOCAL wall clock and therefore shifts by 23 or 25 hours across a system-timezone DST boundary.
 *
 * @param day - Day to shift.
 * @param days - Number of days to add.
 * @returns The shifted day.
 */
function addDaysToISO8601DayString(day: ISO8601DayString, days: number): ISO8601DayString {
  return formatToISO8601DayStringForUTC(new Date(parseISO8601DayStringToUTCDate(day).getTime() + days * MS_IN_DAY));
}

/**
 * Builds an {@link ICalendarEvent} from a {@link CalendarDate}.
 *
 * A {@link CalendarDateType.TIME} input produces a timed event with UTC endpoints, exactly as
 * {@link iCalendarEventForDateDurationSpan} does. A {@link CalendarDateType.DAYS} input produces an all-day
 * event with `VALUE=DATE` endpoints.
 *
 * NOTE: an all-day DTEND is EXCLUSIVE (RFC 5545 3.8.2.2) — it names the day AFTER the last day of the event.
 * A one-day event on 2024-01-15 therefore ends on 2024-01-16.
 *
 * @param calendarDate - The calendar date the event occupies.
 * @param config - The event's UID, descriptive properties, and the zone the calendar date was created in.
 * @returns The event.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarEventForCalendarDate(calendarDate: CalendarDate, config: ICalendarEventForCalendarDateConfig): ICalendarEvent {
  const { timezone, ...eventConfig } = config;
  let result: ICalendarEvent;

  if (calendarDate.type === CalendarDateType.TIME) {
    result = iCalendarEventForDateDurationSpan(calendarDate, eventConfig);
  } else {
    // a CalendarDate's startsAt is local midnight expressed as a real instant, so the wall clock in the
    // originating zone is what carries the calendar day
    const normal = dateTimezoneUtcNormal({ timezone: timezone ? timezone : UTC_TIMEZONE_STRING });
    const startDay = formatToISO8601DayStringForUTC(normal.baseDateToTargetDate(calendarDate.startsAt));

    // an all-day DTEND is exclusive, so a zero/one-day event still spans a single day
    const days = Math.max(Math.round(calendarDate.duration / MINUTES_IN_DAY), 1);

    const start: ICalendarDateOnly = { type: 'date', day: startDay };
    const end: ICalendarDateOnly = { type: 'date', day: addDaysToISO8601DayString(startDay, days) };

    result = { ...eventConfig, start, end };
  }

  return result;
}
