import { type Maybe, type Milliseconds, type Minutes, MINUTES_IN_YEAR, MS_IN_DAY, MS_IN_MINUTE, type TimezoneString, unique } from '@dereekb/util';
import { addMinutes } from 'date-fns';
import { calculateTimezoneOffset } from '../date/date.timezone';
import { getTimezoneAbbreviation } from '../timezone/timezone';
import { type ICalendar, type ICalendarDateTimeValue, type ICalendarTimezone, type ICalendarTimezoneTransition } from './icalendar.model';

/**
 * Configuration for deriving a {@link ICalendarTimezone} over a bounded window.
 */
export interface ICalendarTimezoneForRangeConfig {
  /**
   * The IANA zone to derive. I.E. "America/Denver".
   */
  readonly timezone: TimezoneString;
  /**
   * First instant covered by the derived VTIMEZONE.
   */
  readonly start: Date;
  /**
   * Last instant covered by the derived VTIMEZONE.
   */
  readonly end: Date;
}

/**
 * Interval between offset probes when scanning a window for transitions.
 *
 * A zone never changes its offset twice within a single day, so a daily probe cannot miss a transition; the
 * exact instant is then recovered by bisecting the bracketing day.
 */
export const ICALENDAR_TIMEZONE_PROBE_INTERVAL: Milliseconds = MS_IN_DAY;

/**
 * Bracketing window handed to {@link findICalendarTimezoneTransitionTime}.
 */
interface ICalendarTimezoneTransitionSearch {
  /**
   * The zone being scanned.
   */
  readonly timezone: TimezoneString;
  /**
   * An instant known to still carry {@link lowOffset}.
   */
  readonly lowTime: number;
  /**
   * A later instant known to carry a different offset.
   */
  readonly highTime: number;
  /**
   * The offset in effect at {@link lowTime}.
   */
  readonly lowOffset: Milliseconds;
}

/**
 * Finds the exact instant, to the millisecond, at which the zone's offset stops being the low offset.
 *
 * @param search - The bracketing window to bisect.
 * @returns The first instant carrying the new offset.
 */
function findICalendarTimezoneTransitionTime(search: ICalendarTimezoneTransitionSearch): number {
  const { timezone, lowTime, highTime, lowOffset } = search;

  let low = lowTime;
  let high = highTime;

  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);

    if (calculateTimezoneOffset(timezone, new Date(mid)) === lowOffset) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
}

/**
 * Derives every UTC-offset transition a zone undergoes within the given window.
 *
 * IANA transition rules are not available from any dependency in this package, so they are discovered
 * empirically: the window is probed daily for an offset change, and each detected change is bisected down to
 * the millisecond. The result is a bare list of observances, which is what RFC 5545 3.6.5 requires (only
 * DTSTART, TZOFFSETFROM and TZOFFSETTO are mandatory) and what Apple and Exchange actually emit — no IANA
 * rule has to be reverse-engineered into RRULE form.
 *
 * The first entry is always the observance already in effect at the start of the window.
 *
 * @param config - The zone and window to scan.
 * @returns The transitions, in chronological order. Always at least one.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarTimezoneTransitionsForRange(config: ICalendarTimezoneForRangeConfig): readonly ICalendarTimezoneTransition[] {
  const { timezone, start, end } = config;
  const startTime = start.getTime();
  const endTime = Math.max(end.getTime(), startTime);

  const initialOffset = calculateTimezoneOffset(timezone, start);
  const priorOffset = calculateTimezoneOffset(timezone, new Date(startTime - ICALENDAR_TIMEZONE_PROBE_INTERVAL));

  interface RawTransition {
    readonly at: Date;
    readonly offsetFrom: Milliseconds;
    readonly offsetTo: Milliseconds;
  }

  const raw: RawTransition[] = [{ at: start, offsetFrom: priorOffset, offsetTo: initialOffset }];

  let previousTime = startTime;
  let previousOffset = initialOffset;
  let probeTime = startTime;

  while (probeTime < endTime) {
    probeTime = Math.min(probeTime + ICALENDAR_TIMEZONE_PROBE_INTERVAL, endTime);

    const offset = calculateTimezoneOffset(timezone, new Date(probeTime));

    if (offset !== previousOffset) {
      const transitionTime = findICalendarTimezoneTransitionTime({ timezone, lowTime: previousTime, highTime: probeTime, lowOffset: previousOffset });
      raw.push({ at: new Date(transitionTime), offsetFrom: previousOffset, offsetTo: offset });
      previousOffset = offset;
    }

    previousTime = probeTime;
  }

  // DST always moves a zone further east of its own standard time, so the smallest offset the zone is seen
  // to use is its standard offset and anything above it is a daylight observance. Midwinter and midsummer are
  // probed alongside the window itself, since a window narrower than a season observes only one offset and
  // would otherwise classify a daylight observance as standard.
  const seasonalProbeYear = new Date(startTime).getUTCFullYear();
  const seasonalOffsets = [Date.UTC(seasonalProbeYear, 0, 1), Date.UTC(seasonalProbeYear, 6, 1)].map((x) => calculateTimezoneOffset(timezone, new Date(x)));
  const standardOffset = Math.min(...raw.map((x) => x.offsetTo), ...seasonalOffsets);

  return raw.map(({ at, offsetFrom, offsetTo }) => ({
    daylight: offsetTo > standardOffset,
    startsAt: at,
    offsetFrom: offsetFrom / MS_IN_MINUTE,
    offsetTo: offsetTo / MS_IN_MINUTE,
    name: getTimezoneAbbreviation(timezone, at)
  }));
}

/**
 * Derives a {@link ICalendarTimezone} for the given zone and window.
 *
 * @param config - The zone and window to scan.
 * @returns The VTIMEZONE model.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarTimezoneForRange(config: ICalendarTimezoneForRangeConfig): ICalendarTimezone {
  return {
    timezone: config.timezone,
    transitions: iCalendarTimezoneTransitionsForRange(config)
  };
}

/**
 * Returns every date-time value the calendar's events carry.
 *
 * @param calendar - The calendar to inspect.
 * @returns The values, in event order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarDateTimeValues(calendar: ICalendar): readonly ICalendarDateTimeValue[] {
  const values: ICalendarDateTimeValue[] = [];

  calendar.events.forEach((event) => {
    values.push(event.start);

    if (event.end != null) {
      values.push(event.end);
    }

    if (event.recurrenceId != null) {
      values.push(event.recurrenceId);
    }

    event.recurrence?.additionalDates?.forEach((x) => values.push(x));
    event.recurrence?.exceptionDates?.forEach((x) => values.push(x));
  });

  return values;
}

/**
 * Returns the distinct TZIDs referenced by the calendar's events.
 *
 * @param calendar - The calendar to inspect.
 * @returns The referenced zones, in first-seen order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarReferencedTimezones(calendar: ICalendar): readonly TimezoneString[] {
  return unique(
    iCalendarDateTimeValues(calendar)
      .filter((x) => x.type === 'zoned')
      .map((x) => x.timezone)
  );
}

/**
 * Configuration for {@link iCalendarWithDerivedTimezones}.
 */
export interface ICalendarWithDerivedTimezonesConfig {
  /**
   * Number of minutes to extend the derived window on each side of the events' own range.
   *
   * Defaults to {@link ICALENDAR_DERIVED_TIMEZONE_PADDING}, so a feed whose events sit inside one observance
   * still carries the neighbouring transitions.
   */
  readonly padding?: Maybe<Minutes>;
}

/**
 * Default padding applied on each side of the derived VTIMEZONE window: one year.
 */
export const ICALENDAR_DERIVED_TIMEZONE_PADDING: Minutes = MINUTES_IN_YEAR;

/**
 * Returns a copy of the calendar carrying a derived VTIMEZONE for every zone its events reference.
 *
 * A zoned event is only interpretable by a client when the calendar also carries the matching VTIMEZONE, and
 * hand-writing one is error-prone, so this derives them from the events themselves. A calendar whose events
 * are all UTC or all-day is returned unchanged, since it needs no VTIMEZONE at all.
 *
 * @param calendar - The calendar to complete.
 * @param config - Optional window padding.
 * @returns The calendar, with derived timezones when any are referenced.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarWithDerivedTimezones(calendar: ICalendar, config?: Maybe<ICalendarWithDerivedTimezonesConfig>): ICalendar {
  const values = iCalendarDateTimeValues(calendar);
  const timezones = unique(values.filter((x) => x.type === 'zoned').map((x) => x.timezone));
  let result: ICalendar;

  if (timezones.length === 0) {
    result = calendar;
  } else {
    // a zoned value is never a 'date' value, so a non-empty timezone list guarantees a non-empty instant list
    const instants = values.filter((x) => x.type !== 'date').map((x) => x.at.getTime());
    const padding = config?.padding ?? ICALENDAR_DERIVED_TIMEZONE_PADDING;
    const start = addMinutes(new Date(Math.min(...instants)), -padding);
    const end = addMinutes(new Date(Math.max(...instants)), padding);

    result = { ...calendar, timezones: timezones.map((timezone) => iCalendarTimezoneForRange({ timezone, start, end })) };
  }

  return result;
}
