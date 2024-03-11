import { isDate as dateFnsIsDate, max as maxDate, min as minDate, parseISO, addDays, isPast, isAfter as isAfterDate, set as setDateValues, isValid, startOfMinute, isEqual as isEqualDate, isSameDay as isEqualDay } from 'date-fns';
import { type DayOfWeekNameFunction, type DateOrDateString, filterMaybeValues, type ISO8601DateString, type Maybe, type Minutes, MINUTES_IN_DAY, MS_IN_HOUR, MS_IN_MINUTE, type Seconds, type TimezoneString, type ArrayOrValue, asArray, type MapFunction, type ISO8601DateStringUTCFull, type UTCDateString, isISO8601DateString, type DayOfWeek, dayOfWeek, sortNumbersAscendingFunction } from '@dereekb/util';

export const MAX_FUTURE_DATE = new Date(Date.UTC(9999, 0));

/**
 * Reads a date from the input value
 */
export type ReadDateFunction<T> = MapFunction<T, Date>;

/**
 * Reads a ISO8601DateStringUTCFull value from the input value.
 */
export type ReadISO8601DateStringUTCFullFunction<T> = MapFunction<T, ISO8601DateStringUTCFull>;

/**
 * Returns true if the input is a date.
 *
 * @param input
 * @returns
 */
export function isDate(input: unknown): input is Date {
  return dateFnsIsDate(input);
}

export function msToMinutes(milliseconds: number): Minutes {
  return milliseconds / (60 * 1000);
}

export function msToSeconds(milliseconds: number): Seconds {
  return milliseconds / 1000;
}

export function hoursToMs(hours: number = 1): Minutes {
  return hours * MS_IN_HOUR;
}

export function minutesToMs(minutes: number = 1): Minutes {
  return minutes * MS_IN_MINUTE;
}

export function daysToMinutes(days: number = 1): Minutes {
  return days * MINUTES_IN_DAY;
}

export function maxFutureDate(): Date {
  return MAX_FUTURE_DATE;
}

export function isMaxFutureDate(date: Date): boolean {
  return MAX_FUTURE_DATE.getTime() === date.getTime();
}

export function latestMinute(time = new Date()): Date {
  return startOfMinute(time);
}

export function toISODateString(input: DateOrDateString): ISO8601DateString {
  const date = toJsDate(input);

  if (!isValid(date)) {
    throw new Error('Invalid date passed.');
  }

  return date.toISOString();
}

/**
 * Guesses the current system's timezone.
 *
 * @returns
 */
export function guessCurrentTimezone(): TimezoneString | undefined {
  return Intl.DateTimeFormat()?.resolvedOptions()?.timeZone;
}

/**
 * Convenience function for getCurrentTimezone() that asserts a timezone is returned.
 *
 * @returns
 */
export function requireCurrentTimezone(): TimezoneString {
  const tz = guessCurrentTimezone();

  if (!tz) {
    throw new Error('requireCurrentTimezone() failed to guess the current timezone.');
  }

  return tz;
}

export function safeToJsDate(input: Maybe<DateOrDateString | UTCDateString>): Maybe<Date> {
  return input != null ? toJsDate(input) : undefined;
}

/**
 * Converts the input DateOrDateString to a Date value.
 *
 * @param input
 * @returns
 */
export function toJsDate(input: DateOrDateString | UTCDateString): Date {
  return isDate(input) ? (input as Date) : parseJsDateString(input as string) ?? new Date(input);
}

export function parseJsDateString(input: ISO8601DateString | UTCDateString): Maybe<Date> {
  const date = isISO8601DateString(input) ? parseISO(input as string) : new Date(input);
  return isValid(date) ? date : undefined;
}

/**
 * Returns the earliest date from the input array.
 */
export function earliestDate(dates: Maybe<Date>[]): Maybe<Date>;
export function earliestDate(dates: Maybe<Date>[], defaultDate: Date): Date;
export function earliestDate(dates: Maybe<Date>[], defaultDate: Maybe<Date> = undefined): Maybe<Date> {
  const filtered: Date[] = filterMaybeValues(dates);
  return filtered.length > 0 ? minDate(filtered) : defaultDate;
}

/**
 * Returns the latest date from the input array.
 */
export function latestDate(dates: Maybe<Date>[]): Maybe<Date>;
export function latestDate(dates: Maybe<Date>[], defaultDate: Date): Date;
export function latestDate(dates: Maybe<Date>[], defaultDate: Maybe<Date> = undefined): Maybe<Date> {
  const filtered: Date[] = filterMaybeValues(dates);
  return filtered.length > 0 ? maxDate(filtered) : defaultDate;
}

/**
 * Returns true if a and b are defined and a is after b, otherwise returns the default value.
 */
export function isAfter(a: Maybe<Date>, b: Maybe<Date>): Maybe<boolean>;
export function isAfter(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isAfter(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = undefined): Maybe<boolean> {
  return a && b ? isAfterDate(a, b) : defaultValue;
}

/**
 * Returns true if both a and b are defined and a is equal to b, otherwise returns the default value.
 *
 * The default value is true if a and b are null/undefined.
 *
 * @param a
 * @param b
 */
export function isSameDate(a: Maybe<Date>, b: Maybe<Date>): boolean;
export function isSameDate(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isSameDate(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean>): Maybe<boolean>;
export function isSameDate(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = null): Maybe<boolean> {
  return a != null && b != null ? isEqualDate(a, b) : defaultValue != null ? defaultValue : a == b;
}

/**
 * Returns true if both a and b are the same time down to the rounded down minute.
 *
 * @param a
 * @param b
 */
export function isSameDateHoursAndMinutes(a: Maybe<Date>, b: Maybe<Date>): boolean;
export function isSameDateHoursAndMinutes(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isSameDateHoursAndMinutes(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean>): Maybe<boolean>;
export function isSameDateHoursAndMinutes(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = null): Maybe<boolean> {
  return a != null && b != null ? isEqualDate(roundDownToMinute(a), roundDownToMinute(b)) : defaultValue != null ? defaultValue : a == b;
}

/**
 * Returns true if both a and b are defined and a is on the same day/month/year as b, otherwise returns the default value.
 *
 * The default value is true if a and b are null/undefined.
 *
 * @param a
 * @param b
 */
export function isSameDateDay(a: Maybe<Date>, b: Maybe<Date>): boolean;
export function isSameDateDay(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isSameDateDay(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean>): Maybe<boolean>;
export function isSameDateDay(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = null): Maybe<boolean> {
  return a != null && b != null ? isEqualDay(a, b) : defaultValue != null ? defaultValue : a == b;
}

// MARK: Unix Date/Time
/**
 * Converts the input date to represent the "day" represented in the time.
 *
 * For example, 1/1/2021 should be represented as a UTC-offset date for 1/1/2021 for the first instant of the day.
 */
export function utcDayForDate(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Takes the next occuring time of the input date's hours/minutes.
 *
 * For example, if it is currently 9PM:
 * - if 10PM on any day is passed then 9PM the next day will be returned.
 * - if 11PM on any day is passed, 11PM today will be returned.
 */
export function takeNextUpcomingTime(date: Date, roundDownToMinute?: boolean): Date {
  date = copyHoursAndMinutesFromDateToToday(date, roundDownToMinute);

  if (isPast(date)) {
    date = addDays(date, 1);
  }

  return date;
}

/**
 * Creates a new date and copies the hours/minutes from the previous date and applies them to a date for today.
 */
export function copyHoursAndMinutesFromDateToToday(fromDate: Date, roundDownToMinute?: boolean): Date {
  return copyHoursAndMinutesFromDate(new Date(), fromDate, roundDownToMinute);
}

/**
 * Copies the hours/minutes from now to the target date.
 */
export function copyHoursAndMinutesFromNow(target: Date, roundDownToMinute?: boolean): Date {
  return copyHoursAndMinutesFromDate(target, new Date(), roundDownToMinute);
}

/**
 * Creates a new date and copies the hours/minutes from the input date to the target date.
 */
export function copyHoursAndMinutesFromDate(target: Date, fromDate: Date, roundDownToMinute?: boolean): Date {
  return copyHoursAndMinutesToDate(
    {
      hours: fromDate.getHours(),
      minutes: fromDate.getMinutes(),
      roundDownToMinute
    },
    target
  );
}

/**
 * Creates a new date using UTC and copies the hours/minutes from the input date using the UTC values to the target date.
 */
export function copyHoursAndMinutesFromUTCDate(target: Date, fromDate: Date, roundDownToMinute?: boolean): Date {
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), fromDate.getUTCHours(), fromDate.getUTCMinutes(), roundDownToMinute ? 0 : fromDate.getUTCSeconds(), roundDownToMinute ? 0 : fromDate.getUTCMilliseconds()));
}

/**
 * Creates a new date and copies the hours/minutes from the input onto the target date, if provided. Defaults to now/today otherwise.
 *
 * Also rounds the seconds and milliseconds.
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

export const copyHoursAndMinutesToToday = copyHoursAndMinutesToDate;

/**
 * Removes the seconds and milliseconds from the input date, or returns the current date with no seconds or milliseconds.
 */
export function roundDownToMinute(date = new Date()): Date {
  return setDateValues(date, {
    seconds: 0,
    milliseconds: 0
  });
}

/**
 * Removes all minutes,
 * @param date
 * @returns
 */
export function roundDownToHour(date: Date): Date {
  return setDateValues(date, {
    minutes: 0,
    seconds: 0,
    milliseconds: 0
  });
}

export type ReduceDatesFunction = (inputDates: ArrayOrValue<Maybe<Date>>) => Maybe<Date>;

export function reduceDatesFunction(reduceDates: (dates: Date[]) => Maybe<Date>): ReduceDatesFunction {
  return (inputDates: ArrayOrValue<Maybe<Date>>) => {
    const dates = filterMaybeValues(asArray(inputDates));
    let result: Maybe<Date>;

    if (dates.length) {
      result = reduceDates(dates);
    }

    return result;
  };
}

/**
 * Finds the minimum date in the input. If no dates are input, returns undefined.
 */
export const findMinDate = reduceDatesFunction(minDate);

/**
 * Finds the maximum date in the input. If no dates are input, returns undefined.
 */
export const findMaxDate = reduceDatesFunction(maxDate);

/**
 * Reads the unique days of the week from the given dates, until all the unique dates are returned.
 *
 * @param values
 * @param readDate
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

export function readDaysOfWeekNames<T>(values: T[], readDate: ReadDateFunction<T>, nameFunction: DayOfWeekNameFunction): string[] {
  return Array.from(readDaysOfWeek(values, readDate)).sort(sortNumbersAscendingFunction).map(nameFunction);
}

/**
 * Returns true if the input date is at midnight for UTC.
 *
 * @param date
 * @returns
 */
export function isStartOfDayInUTC(date: Date): boolean {
  return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}

/**
 * Returns true if the input date is at midnight for the system.
 *
 * @param date
 * @returns
 */
export function isStartOfDayForSystem(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
}
