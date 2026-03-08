import { type ISO8601DayString, type DateOrDayString } from '@dereekb/util';
import { toISO8601DayStringForSystem, toJsDayDate } from './date.format';
import { type DateRange } from './date.range';

// MARK: ISO8601DayStringRange
/**
 * A start boundary expressed as an ISO 8601 day string (e.g. "2024-01-15").
 */
export interface ISO8601DayStringStart {
  start: ISO8601DayString;
}

/**
 * A date range expressed as ISO 8601 day strings for both start and end.
 */
export interface ISO8601DayStringRange extends ISO8601DayStringStart {
  end: ISO8601DayString;
}

// MARK: DateOrDayStringRange
/**
 * A start boundary that accepts either a Date object or an ISO 8601 day string.
 */
export interface DateOrDayStringStart {
  start: DateOrDayString;
}

/**
 * A date range where start and end can each be a Date or an ISO 8601 day string.
 */
export interface DateOrDayStringRange extends DateOrDayStringStart {
  end: DateOrDayString;
}

/**
 * Converts a {@link DateOrDayStringRange} to a {@link DateRange} by parsing any string values to the start of their respective days.
 *
 * @param range - the range with Date or string values
 * @returns a DateRange with concrete Date objects
 *
 * @example
 * ```ts
 * const range = dateOrDayStringRangeToDateRange({ start: '2024-01-01', end: '2024-01-31' });
 * // range.start and range.end are Date objects at start of day
 * ```
 */
export function dateOrDayStringRangeToDateRange(range: DateOrDayStringRange): DateRange {
  return {
    start: toJsDayDate(range.start),
    end: toJsDayDate(range.end)
  };
}

/**
 * Converts a {@link DateOrDayStringRange} to an {@link ISO8601DayStringRange} by formatting any Date values as ISO 8601 day strings using the system timezone.
 *
 * @param range - the range with Date or string values
 * @returns a range with both start and end as ISO 8601 day strings
 *
 * @example
 * ```ts
 * const stringRange = dateOrDayStringRangeToISO8601DayStringRange({
 *   start: new Date('2024-01-01T10:00:00Z'),
 *   end: '2024-01-31'
 * });
 * // stringRange.start === '2024-01-01', stringRange.end === '2024-01-31'
 * ```
 */
export function dateOrDayStringRangeToISO8601DayStringRange(range: DateOrDayStringRange): ISO8601DayStringRange {
  return {
    start: toISO8601DayStringForSystem(range.start),
    end: toISO8601DayStringForSystem(range.end)
  };
}
