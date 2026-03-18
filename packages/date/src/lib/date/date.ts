import { isDate as dateFnsIsDate, max as maxDate, min as minDate, parseISO, isAfter as isAfterDate, isBefore as isBeforeDate, isValid, startOfMinute, isEqual as isEqualDate, isSameDay as isEqualDay, set as setDateValues } from 'date-fns';
import {
  type DayOfWeekNameFunction,
  type DateOrDateString,
  filterMaybeArrayValues,
  type ISO8601DateString,
  type Maybe,
  type Minutes,
  MINUTES_IN_DAY,
  MS_IN_HOUR,
  MS_IN_MINUTE,
  type Seconds,
  type TimezoneString,
  type ArrayOrValue,
  asArray,
  type MapFunction,
  type ISO8601DateStringUTCFull,
  type UTCDateString,
  isISO8601DateString,
  type DayOfWeek,
  dayOfWeek,
  sortNumbersAscendingFunction,
  type UnixDateTimeMillisecondsNumber,
  MS_IN_SECOND,
  type DateOrUnixDateTimeMillisecondsNumber,
  type DateHourMinuteOrSecond,
  type FloorOrCeilRounding
} from '@dereekb/util';

/**
 * Sentinel date representing the maximum future date (January 1, 9999 UTC).
 *
 * Used as a placeholder for "no expiration" or "indefinite" scenarios.
 */
export const MAX_FUTURE_DATE = new Date(Date.UTC(9999, 0));

/**
 * Extracts a Date from an arbitrary input value.
 */
export type ReadDateFunction<T> = MapFunction<T, Date>;

/**
 * Extracts an ISO8601 UTC full date string from an arbitrary input value.
 */
export type ReadISO8601DateStringUTCFullFunction<T> = MapFunction<T, ISO8601DateStringUTCFull>;

/**
 * Type guard that checks whether the input is a Date instance.
 *
 * @param input - value to check
 * @returns whether the input is a Date
 *
 * @example
 * ```ts
 * isDate(new Date()); // true
 * isDate('2020-01-01'); // false
 * ```
 */
export function isDate(input: unknown): input is Date {
  return dateFnsIsDate(input);
}

/**
 * Converts milliseconds to minutes.
 *
 * @param milliseconds - duration in milliseconds
 * @returns equivalent duration in minutes
 *
 * @example
 * ```ts
 * msToMinutes(60000); // 1
 * msToMinutes(120000); // 2
 * ```
 */
export function msToMinutes(milliseconds: number): Minutes {
  return milliseconds / (60 * 1000);
}

/**
 * Converts milliseconds to seconds.
 *
 * @param milliseconds - duration in milliseconds
 * @returns equivalent duration in seconds
 *
 * @example
 * ```ts
 * msToSeconds(1000); // 1
 * msToSeconds(2500); // 2.5
 * ```
 */
export function msToSeconds(milliseconds: number): Seconds {
  return milliseconds / 1000;
}

/**
 * Converts hours to milliseconds.
 *
 * @param hours - number of hours (defaults to 1)
 * @returns equivalent duration in milliseconds
 *
 * @example
 * ```ts
 * hoursToMs(1); // 3600000
 * hoursToMs(2); // 7200000
 * ```
 */
export function hoursToMs(hours: number = 1): Minutes {
  return hours * MS_IN_HOUR;
}

/**
 * Converts minutes to milliseconds.
 *
 * @param minutes - number of minutes (defaults to 1)
 * @returns equivalent duration in milliseconds
 *
 * @example
 * ```ts
 * minutesToMs(1); // 60000
 * minutesToMs(5); // 300000
 * ```
 */
export function minutesToMs(minutes: number = 1): Minutes {
  return minutes * MS_IN_MINUTE;
}

/**
 * Converts days to minutes.
 *
 * @param days - number of days (defaults to 1)
 * @returns equivalent duration in minutes
 *
 * @example
 * ```ts
 * daysToMinutes(1); // 1440
 * daysToMinutes(7); // 10080
 * ```
 */
export function daysToMinutes(days: number = 1): Minutes {
  return days * MINUTES_IN_DAY;
}

/**
 * Returns the {@link MAX_FUTURE_DATE} sentinel value (January 1, 9999 UTC).
 *
 * Useful as a default for "no expiration" comparisons.
 *
 * @example
 * ```ts
 * const futureDate = maxFutureDate();
 * // futureDate === MAX_FUTURE_DATE
 * ```
 */
export function maxFutureDate(): Date {
  return MAX_FUTURE_DATE;
}

/**
 * Checks whether the given date matches the {@link MAX_FUTURE_DATE} sentinel.
 *
 * @param date - date to check
 * @returns whether the date is the max future sentinel
 *
 * @example
 * ```ts
 * isMaxFutureDate(MAX_FUTURE_DATE); // true
 * isMaxFutureDate(new Date()); // false
 * ```
 */
export function isMaxFutureDate(date: Date): boolean {
  return MAX_FUTURE_DATE.getTime() === date.getTime();
}

/**
 * Returns the start of the current minute for the given time, effectively truncating seconds and milliseconds.
 *
 * Defaults to the current time if no input is provided.
 *
 * @param time - date to truncate (defaults to now)
 * @returns date rounded down to the start of the minute
 *
 * @example
 * ```ts
 * const date = new Date('2024-01-01T12:30:45.123Z');
 * const result = latestMinute(date);
 * // result === 2024-01-01T12:30:00.000Z
 * ```
 */
export function latestMinute(time = new Date()): Date {
  return startOfMinute(time);
}

/**
 * Converts the input to an ISO 8601 date string.
 *
 * @param input - date or date string to convert
 * @returns the ISO 8601 string representation
 * @throws {Error} When the input cannot be parsed as a valid date.
 *
 * @example
 * ```ts
 * toISODateString(new Date('2024-01-01T00:00:00.000Z'));
 * // '2024-01-01T00:00:00.000Z'
 * ```
 */
export function toISODateString(input: DateOrDateString): ISO8601DateString {
  const date = toJsDate(input);

  if (!isValid(date)) {
    throw new Error('Invalid date passed.');
  }

  return date.toISOString();
}

/**
 * Guesses the current system's timezone using the Intl API.
 *
 * @returns the IANA timezone string (e.g. "America/Chicago"), or undefined if detection fails
 *
 * @example
 * ```ts
 * const tz = guessCurrentTimezone();
 * // tz === 'America/New_York' (or similar)
 * ```
 */
export function guessCurrentTimezone(): TimezoneString | undefined {
  return Intl.DateTimeFormat()?.resolvedOptions()?.timeZone;
}

/**
 * Returns the current system's timezone, throwing if detection fails.
 *
 * Convenience wrapper around {@link guessCurrentTimezone} for contexts where a timezone is required.
 *
 * @returns the IANA timezone string
 * @throws {Error} When the timezone cannot be detected from the Intl API.
 *
 * @example
 * ```ts
 * const tz = requireCurrentTimezone();
 * // tz === 'America/New_York' (guaranteed non-undefined)
 * ```
 */
export function requireCurrentTimezone(): TimezoneString {
  const tz = guessCurrentTimezone();

  if (!tz) {
    throw new Error('requireCurrentTimezone() failed to guess the current timezone.');
  }

  return tz;
}

/**
 * Null-safe variant of {@link toJsDate} that returns undefined for null/undefined input.
 *
 * @param input - date, date string, or null/undefined
 * @returns the parsed Date or undefined if input was nullish
 *
 * @example
 * ```ts
 * safeToJsDate('2024-01-01T00:00:00.000Z'); // Date instance
 * safeToJsDate(undefined); // undefined
 * ```
 */
export function safeToJsDate(input: Maybe<DateOrDateString | UTCDateString>): Maybe<Date> {
  return input != null ? toJsDate(input) : undefined;
}

/**
 * Converts the input to a JavaScript Date instance. Accepts Date objects, ISO 8601 strings, UTC date strings, and unix millisecond timestamps.
 *
 * @param input - value to convert
 * @returns the parsed Date
 *
 * @example
 * ```ts
 * toJsDate('2024-01-01T00:00:00.000Z'); // Date instance
 * toJsDate(new Date()); // same Date returned
 * toJsDate(1704067200000); // Date from unix ms
 * ```
 */
export function toJsDate(input: DateOrDateString | UTCDateString | UnixDateTimeMillisecondsNumber): Date {
  return isDate(input) ? (input as Date) : (parseJsDateString(input as string) ?? new Date(input));
}

/**
 * Parses a date string or unix milliseconds timestamp into a Date, returning undefined if the result is invalid.
 *
 * Prefers `parseISO` for ISO 8601 strings to avoid browser inconsistencies with `new Date()`.
 *
 * @param input - ISO 8601 string, UTC date string, or unix milliseconds
 * @returns the parsed Date, or undefined if invalid
 *
 * @example
 * ```ts
 * parseJsDateString('2020-04-30T00:00:00.000'); // Date instance
 * parseJsDateString('Sat, 03 Feb 2001 04:05:06 GMT'); // Date instance
 * parseJsDateString('not-a-date'); // undefined
 * ```
 */
export function parseJsDateString(input: ISO8601DateString | UTCDateString | UnixDateTimeMillisecondsNumber): Maybe<Date> {
  const date = typeof input === 'string' && isISO8601DateString(input) ? parseISO(input as string) : new Date(input);
  return isValid(date) ? date : undefined;
}

/**
 * Returns the earliest (minimum) date from the input array, ignoring null/undefined entries.
 *
 * @param dates - array of dates that may contain null/undefined
 * @param defaultDate - fallback if no valid dates exist
 * @returns the earliest date, or the default if the array has no valid dates
 *
 * @example
 * ```ts
 * const a = new Date('2024-01-01');
 * const b = new Date('2024-06-01');
 * earliestDate([a, b]); // a
 * earliestDate([null, undefined], new Date()); // falls back to default
 * ```
 */
export function earliestDate(dates: Maybe<Date>[]): Maybe<Date>;
export function earliestDate(dates: Maybe<Date>[], defaultDate: Date): Date;
export function earliestDate(dates: Maybe<Date>[], defaultDate: Maybe<Date> = undefined): Maybe<Date> {
  const filtered: Date[] = filterMaybeArrayValues(dates);
  return filtered.length > 0 ? minDate(filtered) : defaultDate;
}

/**
 * Returns the latest (maximum) date from the input array, ignoring null/undefined entries.
 *
 * @param dates - array of dates that may contain null/undefined
 * @param defaultDate - fallback if no valid dates exist
 * @returns the latest date, or the default if the array has no valid dates
 *
 * @example
 * ```ts
 * const a = new Date('2024-01-01');
 * const b = new Date('2024-06-01');
 * latestDate([a, b]); // b
 * latestDate([null], new Date()); // falls back to default
 * ```
 */
export function latestDate(dates: Maybe<Date>[]): Maybe<Date>;
export function latestDate(dates: Maybe<Date>[], defaultDate: Date): Date;
export function latestDate(dates: Maybe<Date>[], defaultDate: Maybe<Date> = undefined): Maybe<Date> {
  const filtered: Date[] = filterMaybeArrayValues(dates);
  return filtered.length > 0 ? maxDate(filtered) : defaultDate;
}

/**
 * Null-safe date comparison that returns true when `a` is chronologically after `b`.
 *
 * If either date is null/undefined, returns the default value instead.
 *
 * @param a - first date
 * @param b - second date to compare against
 * @param defaultValue - returned when either date is nullish
 * @returns whether `a` is after `b`, or the default
 *
 * @example
 * ```ts
 * const jan = new Date('2024-01-01');
 * const feb = new Date('2024-02-01');
 * isAfter(feb, jan); // true
 * isAfter(null, jan); // undefined
 * isAfter(null, jan, false); // false
 * ```
 */
export function isAfter(a: Maybe<Date>, b: Maybe<Date>): Maybe<boolean>;
export function isAfter(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isAfter(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = undefined): Maybe<boolean> {
  return a && b ? isAfterDate(a, b) : defaultValue;
}

/**
 * Null-safe date comparison that returns true when `a` is chronologically before `b`.
 *
 * If either date is null/undefined, returns the default value instead.
 *
 * @param a - first date
 * @param b - second date to compare against
 * @param defaultValue - returned when either date is nullish
 * @returns whether `a` is before `b`, or the default
 *
 * @example
 * ```ts
 * const jan = new Date('2024-01-01');
 * const feb = new Date('2024-02-01');
 * isBefore(jan, feb); // true
 * isBefore(null, feb); // undefined
 * isBefore(null, feb, false); // false
 * ```
 */
export function isBefore(a: Maybe<Date>, b: Maybe<Date>): Maybe<boolean>;
export function isBefore(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isBefore(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = undefined): Maybe<boolean> {
  return a && b ? isBeforeDate(a, b) : defaultValue;
}

/**
 * Null-safe exact date equality check (millisecond precision).
 *
 * When both dates are null/undefined and no default is provided, returns true (treating two absent values as equal).
 *
 * @param a - first date
 * @param b - second date
 * @param defaultValue - returned when either date is nullish (defaults to `a == b` if not provided)
 * @returns whether the dates are exactly equal
 *
 * @example
 * ```ts
 * const d = new Date('2024-01-01T00:00:00.000Z');
 * isSameDate(d, new Date(d.getTime())); // true
 * isSameDate(null, null); // true
 * isSameDate(null, d); // false
 * ```
 */
export function isSameDate(a: Maybe<Date>, b: Maybe<Date>): boolean;
export function isSameDate(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isSameDate(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean>): Maybe<boolean>;
export function isSameDate(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = null): Maybe<boolean> {
  return a != null && b != null ? isEqualDate(a, b) : defaultValue != null ? defaultValue : a == b;
}

/**
 * Null-safe date equality check that compares only down to the minute (ignoring seconds and milliseconds).
 *
 * Rounds both dates down to the start of their respective minutes before comparing.
 *
 * @param a - first date
 * @param b - second date
 * @param defaultValue - returned when either date is nullish
 * @returns whether both dates fall within the same minute
 *
 * @example
 * ```ts
 * const a = new Date('2024-01-01T12:30:00.000Z');
 * const b = new Date('2024-01-01T12:30:45.999Z');
 * isSameDateHoursAndMinutes(a, b); // true
 * ```
 */
export function isSameDateHoursAndMinutes(a: Maybe<Date>, b: Maybe<Date>): boolean;
export function isSameDateHoursAndMinutes(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isSameDateHoursAndMinutes(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean>): Maybe<boolean>;
export function isSameDateHoursAndMinutes(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = null): Maybe<boolean> {
  return a != null && b != null ? isEqualDate(roundDownToMinute(a), roundDownToMinute(b)) : defaultValue != null ? defaultValue : a == b;
}

/**
 * Null-safe day-level date equality check (same year, month, and day, ignoring time).
 *
 * When both dates are null/undefined and no default is provided, returns true (treating two absent values as equal).
 *
 * @param a - first date
 * @param b - second date
 * @param defaultValue - returned when either date is nullish
 * @returns whether both dates fall on the same calendar day
 *
 * @example
 * ```ts
 * const morning = new Date('2024-01-01T08:00:00.000Z');
 * const evening = new Date('2024-01-01T20:00:00.000Z');
 * isSameDateDay(morning, evening); // true
 * isSameDateDay(null, null); // true
 * ```
 */
export function isSameDateDay(a: Maybe<Date>, b: Maybe<Date>): boolean;
export function isSameDateDay(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isSameDateDay(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean>): Maybe<boolean>;
export function isSameDateDay(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = null): Maybe<boolean> {
  return a != null && b != null ? isEqualDay(a, b) : defaultValue != null ? defaultValue : a == b;
}

// MARK: Unix Date/Time
/**
 * Converts a local date to a UTC date representing the same calendar day at midnight.
 *
 * Useful for normalizing dates to UTC day boundaries when comparing calendar days across timezones.
 *
 * @param date - local date to convert
 * @returns a UTC Date at midnight for the same calendar day
 *
 * @example
 * ```ts
 * const local = new Date(2021, 0, 1, 15, 30); // Jan 1, 2021 3:30 PM local
 * const utcDay = utcDayForDate(local);
 * // utcDay === 2021-01-01T00:00:00.000Z
 * ```
 */
export function utcDayForDate(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Creates a new UTC date by copying the UTC hours and minutes from `fromDate` onto the `target` date's UTC year/month/day.
 *
 * Optionally zeroes out seconds and milliseconds when `roundDownToMinute` is true.
 *
 * @param target - date providing the UTC year/month/day
 * @param fromDate - date providing the UTC hours/minutes
 * @param roundDownToMinute - whether to zero out seconds and milliseconds
 * @returns a new UTC Date combining the target's day with the source's time
 *
 * @example
 * ```ts
 * const target = new Date('2024-03-15T00:00:00.000Z');
 * const source = new Date('2024-01-01T14:30:45.000Z');
 * const result = copyHoursAndMinutesFromUTCDate(target, source, true);
 * // result === 2024-03-15T14:30:00.000Z
 * ```
 */
export function copyHoursAndMinutesFromUTCDate(target: Date, fromDate: Date, roundDownToMinute?: boolean): Date {
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), fromDate.getUTCHours(), fromDate.getUTCMinutes(), roundDownToMinute ? 0 : fromDate.getUTCSeconds(), roundDownToMinute ? 0 : fromDate.getUTCMilliseconds()));
}

/**
 * Sets the hours and optionally minutes on a target date (defaults to now), with optional rounding to strip seconds/milliseconds.
 *
 * @param config - hours, optional minutes, and rounding options
 * @param target - date to modify (defaults to the current date/time)
 * @returns a new Date with the specified time values applied
 *
 * @example
 * ```ts
 * const target = new Date('2024-01-01T00:00:00.000Z');
 * const result = copyHoursAndMinutesToDate({ hours: 14, minutes: 30 }, target);
 * // result has hours=14, minutes=30, seconds=0, milliseconds=0
 * ```
 */
export function copyHoursAndMinutesToDate({ hours, minutes, removeSeconds, roundDownToMinute = true }: { hours: number; minutes?: number; removeSeconds?: boolean; roundDownToMinute?: boolean }, target?: Maybe<Date>): Date {
  return setDateValues(target ?? new Date(), {
    hours,
    ...(minutes != null
      ? {
          minutes
        }
      : undefined),
    // Remove Seconds/Milliseconds
    ...(roundDownToMinute || removeSeconds
      ? {
          seconds: 0,
          milliseconds: 0
        }
      : undefined)
  });
}

/**
 * Alias for {@link copyHoursAndMinutesToDate}.
 */
export const copyHoursAndMinutesToToday = copyHoursAndMinutesToDate;

/**
 * Truncates seconds and milliseconds from the input date, effectively rounding down to the start of the minute.
 *
 * @param date - date to round (defaults to now)
 * @returns the date with seconds and milliseconds set to zero
 *
 * @example
 * ```ts
 * const date = new Date('2024-01-01T12:30:45.123Z');
 * roundDownToMinute(date); // 2024-01-01T12:30:00.000Z
 * ```
 */
export function roundDownToMinute(date = new Date()): Date {
  return roundDateDownTo(date, 'minute');
}

/**
 * Truncates minutes, seconds, and milliseconds from the input date, effectively rounding down to the start of the hour.
 *
 * @param date - date to round (defaults to now)
 * @returns the date with minutes, seconds, and milliseconds set to zero
 *
 * @example
 * ```ts
 * const date = new Date('2024-01-01T12:30:45.123Z');
 * roundDownToHour(date); // 2024-01-01T12:00:00.000Z
 * ```
 */
export function roundDownToHour(date: Date = new Date()): Date {
  return roundDateDownTo(date, 'hour');
}

/**
 * Convenience function that rounds a date down (floor) to the specified unit.
 *
 * @param date - date to round
 * @param roundToUnit - time unit to round to ('hour', 'minute', or 'second')
 * @returns a new Date rounded down to the unit boundary
 */
export function roundDateDownTo(date: Date, roundToUnit: DateHourMinuteOrSecond): Date {
  return roundDateToDate(date, roundToUnit, 'floor');
}

/**
 * Rounds a date or unix timestamp to the nearest unit boundary using the specified rounding direction.
 *
 * Preserves the input type: Date inputs return Date, number inputs return number.
 *
 * @param date - date or unix millisecond timestamp to round
 * @param roundToUnit - time unit to round to ('hour', 'minute', or 'second')
 * @param roundType - rounding direction ('floor' or 'ceil', defaults to 'floor')
 * @returns the rounded value in the same type as the input
 */
export function roundDateTo(date: Date, roundToUnit: DateHourMinuteOrSecond, roundType?: FloorOrCeilRounding): Date;
export function roundDateTo(unixDateTimeNumber: UnixDateTimeMillisecondsNumber, roundToUnit: DateHourMinuteOrSecond, roundType?: FloorOrCeilRounding): UnixDateTimeMillisecondsNumber;
export function roundDateTo(date: DateOrUnixDateTimeMillisecondsNumber, roundToUnit: DateHourMinuteOrSecond, roundType: FloorOrCeilRounding = 'floor'): DateOrUnixDateTimeMillisecondsNumber {
  return typeof date === 'number' ? roundDateToUnixDateTimeNumber(date, roundToUnit, roundType) : roundDateToDate(date, roundToUnit, roundType);
}

/**
 * Rounds a date or unix timestamp to the nearest unit boundary, always returning a Date.
 *
 * @param date - date or unix millisecond timestamp to round
 * @param roundToUnit - time unit to round to ('hour', 'minute', or 'second')
 * @param roundType - rounding direction ('floor' or 'ceil', defaults to 'floor')
 * @returns a new Date rounded to the unit boundary
 *
 * @example
 * ```ts
 * const date = new Date('2024-01-01T01:05:07.123Z');
 * roundDateToDate(date, 'hour', 'floor'); // 2024-01-01T01:00:00.000Z
 * roundDateToDate(date, 'minute', 'ceil'); // 2024-01-01T01:06:00.000Z
 * ```
 */
export function roundDateToDate(date: DateOrUnixDateTimeMillisecondsNumber, roundToUnit: DateHourMinuteOrSecond, roundType: FloorOrCeilRounding = 'floor'): Date {
  return new Date(roundDateToUnixDateTimeNumber(date, roundToUnit, roundType));
}

/**
 * Rounds a date or unix timestamp to the nearest hour, minute, or second boundary using pure arithmetic on the millisecond value.
 *
 * This approach avoids DST issues that can occur with date-fns `set()` or native `Date.setMinutes()`, which may produce
 * incorrect results during fall-back transitions.
 *
 * @param date - date or unix millisecond timestamp to round
 * @param roundToUnit - time unit to round to ('hour', 'minute', or 'second')
 * @param roundType - rounding direction ('floor' truncates, 'ceil' rounds up)
 * @returns the rounded unix millisecond timestamp
 *
 * @example
 * ```ts
 * const date = new Date('2024-01-01T01:05:07.123Z');
 * roundDateToUnixDateTimeNumber(date, 'hour', 'floor'); // ms for 2024-01-01T01:00:00.000Z
 * roundDateToUnixDateTimeNumber(date, 'minute', 'ceil'); // ms for 2024-01-01T01:06:00.000Z
 * ```
 */
export function roundDateToUnixDateTimeNumber(date: DateOrUnixDateTimeMillisecondsNumber, roundToUnit: DateHourMinuteOrSecond, roundType: FloorOrCeilRounding = 'floor'): UnixDateTimeMillisecondsNumber {
  const inputTimeUnrounded = typeof date === 'number' ? date : date.getTime();

  let roundAmount: number = 0;

  switch (roundToUnit) {
    case 'hour':
      roundAmount = MS_IN_HOUR;
      break;
    case 'second':
      roundAmount = MS_IN_SECOND;
      break;
    default:
    case 'minute':
      roundAmount = MS_IN_MINUTE;
      break;
  }

  const secondsAndMs = inputTimeUnrounded % roundAmount; // determine the number of seconds and milliseconds (prepare to round to nearest minute)
  let roundedTime: number = inputTimeUnrounded;

  if (secondsAndMs !== 0) {
    roundedTime = inputTimeUnrounded - secondsAndMs; // remove seconds and ms as it will throw off the final tzOffset

    if (roundType === 'ceil') {
      roundedTime += roundAmount; // round up by adding the units
    }
  }

  return roundedTime;
}

/**
 * Function that reduces an array (or single value) of possibly-null dates into a single Date result.
 */
export type ReduceDatesFunction = (inputDates: ArrayOrValue<Maybe<Date>>) => Maybe<Date>;

/**
 * Creates a {@link ReduceDatesFunction} that filters out null/undefined values, then applies the given reducer to the remaining dates.
 *
 * Returns undefined if no valid dates are present in the input.
 *
 * @param reduceDates - reducer function applied to the non-null dates array
 * @returns a function that accepts an array or single date value and returns the reduced result
 *
 * @example
 * ```ts
 * import { min } from 'date-fns';
 * const findMin = reduceDatesFunction(min);
 * findMin([new Date('2024-01-01'), new Date('2024-06-01')]); // Jan 1
 * findMin([null, undefined]); // undefined
 * ```
 */
export function reduceDatesFunction(reduceDates: (dates: Date[]) => Maybe<Date>): ReduceDatesFunction {
  return (inputDates: ArrayOrValue<Maybe<Date>>) => {
    const dates = filterMaybeArrayValues(asArray(inputDates));
    let result: Maybe<Date>;

    if (dates.length) {
      result = reduceDates(dates);
    }

    return result;
  };
}

/**
 * Finds the minimum (earliest) date from the input, ignoring null/undefined values. Returns undefined if no valid dates are provided.
 *
 * @example
 * ```ts
 * findMinDate([new Date('2024-06-01'), new Date('2024-01-01')]); // Jan 1
 * findMinDate([null]); // undefined
 * ```
 */
export const findMinDate = reduceDatesFunction(minDate);

/**
 * Finds the maximum (latest) date from the input, ignoring null/undefined values. Returns undefined if no valid dates are provided.
 *
 * @example
 * ```ts
 * findMaxDate([new Date('2024-01-01'), new Date('2024-06-01')]); // Jun 1
 * findMaxDate([null]); // undefined
 * ```
 */
export const findMaxDate = reduceDatesFunction(maxDate);

/**
 * Collects the unique days of the week present among the given values, short-circuiting once all 7 days are found.
 *
 * @param values - items to extract dates from
 * @param readDate - function to extract a Date from each value
 * @returns a Set of DayOfWeek values (0=Sunday through 6=Saturday)
 *
 * @example
 * ```ts
 * const dates = [new Date('2024-01-01'), new Date('2024-01-02')]; // Mon, Tue
 * const days = readDaysOfWeek(dates, (d) => d);
 * // days contains DayOfWeek.MONDAY and DayOfWeek.TUESDAY
 * ```
 */
export function readDaysOfWeek<T>(values: T[], readDate: ReadDateFunction<T>): Set<DayOfWeek> {
  const result = new Set<DayOfWeek>();

  for (const value of values) {
    const date = readDate(value);
    const day = dayOfWeek(date);

    if (!result.has(day)) {
      result.add(day);

      if (result.size === 7) {
        break; // got all the days
      }
    }
  }

  return result;
}

/**
 * Returns the display names of the unique days of the week present among the values, sorted by day number (Sunday first).
 *
 * @param values - items to extract dates from
 * @param readDate - function to extract a Date from each value
 * @param nameFunction - function that converts a DayOfWeek to its display name
 * @returns sorted array of day name strings
 *
 * @example
 * ```ts
 * const dates = [new Date('2024-01-02'), new Date('2024-01-01')]; // Tue, Mon
 * const names = readDaysOfWeekNames(dates, (d) => d, (day) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]);
 * // names === ['Mon', 'Tue']
 * ```
 */
export function readDaysOfWeekNames<T>(values: T[], readDate: ReadDateFunction<T>, nameFunction: DayOfWeekNameFunction): string[] {
  return Array.from(readDaysOfWeek(values, readDate)).sort(sortNumbersAscendingFunction).map(nameFunction);
}

/**
 * Checks whether the given date falls exactly at midnight (00:00:00.000) in UTC.
 *
 * @param date - date to check
 * @returns whether all UTC time components are zero
 *
 * @example
 * ```ts
 * isStartOfDayInUTC(new Date('2024-01-01T00:00:00.000Z')); // true
 * isStartOfDayInUTC(new Date('2024-01-01T00:00:01.000Z')); // false
 * ```
 */
export function isStartOfDayInUTC(date: Date): boolean {
  return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}

/**
 * Checks whether the given date falls at the end of the day (23:59:59.999) in UTC.
 *
 * @param date - date to check
 * @param minutesOnly - if true, only checks hours and minutes (23:59), ignoring seconds and milliseconds
 * @returns whether the date represents end-of-day in UTC
 *
 * @example
 * ```ts
 * isEndOfDayInUTC(new Date('2024-01-01T23:59:59.999Z')); // true
 * isEndOfDayInUTC(new Date('2024-01-01T23:59:00.000Z'), true); // true (minutes-only mode)
 * ```
 */
export function isEndOfDayInUTC(date: Date, minutesOnly: boolean = false): boolean {
  return date.getUTCHours() === 23 && date.getUTCMinutes() === 59 && (minutesOnly || (date.getUTCSeconds() === 59 && date.getUTCMilliseconds() === 999));
}

/**
 * Checks whether the given date falls exactly at midnight (00:00:00.000) in the system's local timezone.
 *
 * @param date - date to check
 * @returns whether all local time components are zero
 *
 * @example
 * ```ts
 * const midnight = new Date(2024, 0, 1, 0, 0, 0, 0);
 * isStartOfDayForSystem(midnight); // true
 * ```
 */
export function isStartOfDayForSystem(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
}
