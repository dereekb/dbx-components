import { type ISO8601DayString, type DateOrDayString, type Maybe, type MaybeMap, isISO8601DayString } from '@dereekb/util';
import { endOfDay, isValid } from 'date-fns';
import { parseISO8601DayStringToDate, toISO8601DayStringForSystem, toJsDayDate } from './date.format';
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
 * @param range - The range with Date or string values.
 * @returns A DateRange with concrete Date objects.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, range, day, string, iso8601, parse, convert, to
 * @dbxUtilRelated date-or-day-string-range-to-iso8601-day-string-range, iso8601-day-string-range-params-to-date-range
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
 * @param range - The range with Date or string values.
 * @returns A range with both start and end as ISO 8601 day strings.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, range, day, string, iso8601, params, url, query, route, format, convert, to
 * @dbxUtilRelated date-or-day-string-range-to-date-range, iso8601-day-string-range-params-to-date-range
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

// MARK: ISO8601DayStringRangeParams
/**
 * An {@link ISO8601DayStringRange} read from an untrusted source such as a route's `start`/`end` query params, where either
 * value may be missing or malformed.
 *
 * Converted to a {@link DateRange} with {@link iso8601DayStringRangeParamsToDateRange}. Write a range back as params with
 * {@link dateOrDayStringRangeToISO8601DayStringRange}.
 */
export type ISO8601DayStringRangeParams = MaybeMap<Partial<ISO8601DayStringRange>>;

/**
 * Converts {@link ISO8601DayStringRangeParams} to a {@link DateRange}, reading the days in the system timezone.
 *
 * Unlike {@link dateOrDayStringRangeToDateRange}, the values are checked first, and the range ends at the end of the end day.
 * A start that is missing or not a valid ISO 8601 day string returns undefined. An end that is missing, invalid, or before the
 * start is ignored, so the range covers just the start day.
 *
 * @param params - The params to read, typically the current route's params.
 * @returns The date range, or undefined when there is no valid start day.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, range, day, string, iso8601, params, url, query, route, parse, validate, convert, to
 * @dbxUtilRelated date-or-day-string-range-to-iso8601-day-string-range, date-or-day-string-range-to-date-range
 *
 * @example
 * ```ts
 * iso8601DayStringRangeParamsToDateRange({ start: '2026-10-14', end: '2026-10-20' });
 * // { start: 2026-10-14T00:00:00, end: 2026-10-20T23:59:59.999 } (system timezone)
 *
 * iso8601DayStringRangeParamsToDateRange({ start: '2026-10-14' });
 * // { start: 2026-10-14T00:00:00, end: 2026-10-14T23:59:59.999 }
 *
 * iso8601DayStringRangeParamsToDateRange({ start: 'tomorrow' });
 * // undefined
 * ```
 */
export function iso8601DayStringRangeParamsToDateRange(params: Maybe<ISO8601DayStringRangeParams>): Maybe<DateRange> {
  const parseDay = (value: unknown): Maybe<Date> => {
    const date = typeof value === 'string' && isISO8601DayString(value) ? parseISO8601DayStringToDate(value) : undefined;
    return date && isValid(date) ? date : undefined;
  };

  let result: Maybe<DateRange>;
  const start = parseDay(params?.start);

  if (start) {
    const endDay = parseDay(params?.end);
    result = {
      start,
      end: endOfDay(endDay && endDay >= start ? endDay : start)
    };
  }

  return result;
}
