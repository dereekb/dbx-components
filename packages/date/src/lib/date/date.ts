import {
  isDate, max as maxDate, parseISO, addDays, isPast, isAfter as isAfterDate, set as setDateValues, isValid, startOfMinute
} from 'date-fns';
import { DateOrDateString, filterMaybeValues, ISO8601DateString, Maybe, Minutes, MINUTES_IN_DAY, MS_IN_HOUR, MS_IN_MINUTE, Seconds } from '@dereekb/util';

export const MAX_FUTURE_DATE = new Date(Date.UTC(9999, 0));

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

export function latestMinute(time = new Date): Date {
  return startOfMinute(time);
}

export function toISODateString(input: DateOrDateString): ISO8601DateString {
  const date = toJsDate(input);

  if (!isValid(date)) {
    throw new Error('Invalid date passed.');
  }

  return date.toISOString();
}

export function guessCurrentTimezone(): string {
  return Intl.DateTimeFormat()?.resolvedOptions()?.timeZone;
}

/**
 * Converts the input DateOrDateString to a Date value.
 * 
 * @param input 
 * @returns 
 */
export function toJsDate(input: DateOrDateString): Date {
  return (isDate(input) ? input as Date : parseISO(input as string));
}

/**
 * Returns the latest date from the input array.
 */
export function latestDate(dates: Maybe<Date>[]): Maybe<Date>;
export function latestDate(dates: Maybe<Date>[], defaultDate: Date): Date;
export function latestDate(dates: Maybe<Date>[], defaultDate: Maybe<Date> = undefined): Maybe<Date> {
  const filtered: Date[] = filterMaybeValues(dates);
  return (filtered.length > 0) ? maxDate(filtered) : undefined;
}

/**
 * Returns true if a and b are defined and a is after b, otherwise returns the default value.
 */
export function isAfter(a: Maybe<Date>, b: Maybe<Date>): Maybe<boolean>;
export function isAfter(a: Maybe<Date>, b: Maybe<Date>, defaultValue: boolean): boolean;
export function isAfter(a: Maybe<Date>, b: Maybe<Date>, defaultValue: Maybe<boolean> = undefined): Maybe<boolean> {
  return (a && b) ? isAfterDate(a, b) : defaultValue;
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
export function takeNextUpcomingTime(date: Date, removeSeconds?: boolean): Date {
  date = copyHoursAndMinutesFromDateToToday(date, removeSeconds);

  if (isPast(date)) {
    date = addDays(date, 1);
  }

  return date;
}

/**
 * Creates a new date and copies the hours/minutes from the previous date.
 */
export function copyHoursAndMinutesFromDateToToday(date: Date, removeSeconds?: boolean): Date {
  return copyHoursAndMinutesToToday({
    hours: date.getHours(),
    minutes: date.getMinutes(),
    removeSeconds
  });
}

/**
 * Creates a new date and copies the hours/minutes from the input.
 * 
 * Also rounds the seconds and milliseconds.
 */
export function copyHoursAndMinutesToToday({ hours, minutes, removeSeconds = true }: { hours: number, minutes?: number, removeSeconds?: boolean }): Date {
  return setDateValues(new Date(), {
    hours,
    ...(minutes != null) ? {
      minutes
    } : undefined,
    // Remove Seconds/Milliseconds
    ...(removeSeconds) ? {
      seconds: 0,
      milliseconds: 0
    } : undefined
  });
}

/**
 * Removes the seconds and milliseconds from the input date.
 */
export function roundDownToMinute(date = new Date()): Date {
  return setDateValues(date, {
    seconds: 0,
    milliseconds: 0
  });
}
