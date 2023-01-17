import { Maybe } from '../value/maybe.type';

/**
 * A valid ISO8601 formatted date string.
 */
export type ISO8601DateString = string;

/**
 * A full ISO8601 date string that is in UTC.
 *
 * I.E. 2020-04-30T00:00:00.000Z
 */
export type ISO8601DateStringUTCFull = string;

/**
 * A valid timezone string.
 */
export type TimezoneString = string;

/**
 * Object that references a TimezoneString.
 */
export interface TimezoneStringRef {
  timezone: TimezoneString;
}

export const UTC_TIMEZONE_STRING = 'UTC';

/**
 * Whether or not the input timezone string is considered UTC.
 *
 * @param timezone
 * @returns
 */
export function isConsideredUtcTimezoneString(timezone: Maybe<TimezoneString>): boolean;
export function isConsideredUtcTimezoneString(timezone: TimezoneString): boolean;
export function isConsideredUtcTimezoneString(timezone: 'UTC'): true;
export function isConsideredUtcTimezoneString(timezone: null): true;
export function isConsideredUtcTimezoneString(timezone: undefined): true;
export function isConsideredUtcTimezoneString(timezone: Maybe<TimezoneString>): boolean {
  return timezone == null || timezone === UTC_TIMEZONE_STRING;
}

/**
 * A Date or an ISO8601DateString.
 */
export type DateOrDateString = Date | ISO8601DateString;

/**
 * A full date string Formatted as ISO8601.
 *
 * Year, Month, Day
 *
 * I.E. 1921-06-23
 */
export type ISO8601DayString = string; // '1921-06-23'

/**
 * Regex for an ISO8601DayString.
 */
export const ISO8601_DAY_STRING_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isISO8601DayString(input: string): input is ISO8601DayString {
  return ISO8601_DAY_STRING_REGEX.test(input);
}

/**
 * Date that is represented by slashes. Is considered in the Month/Day/Year format.
 */
export type MonthDaySlashDate = string; // 11/1/21

/**
 * Converts the input MonthDaySlashDate to an ISO8601DayString.
 *
 * @param slashDate
 * @returns
 */
export function monthDaySlashDateToDateString(slashDate: MonthDaySlashDate): ISO8601DayString {
  let [month, day, year] = slashDate.split('/');

  if (month.length === 1) {
    month = `0${month}`;
  }

  if (day.length === 1) {
    day = `0${day}`;
  }

  if (year.length === 2) {
    year = `20${year}`;
  }

  const result = `${year}-${month}-${day}`;
  return result;
}

/**
 * Time in seconds (instead of ms) since the epoch.
 */
export type UnixDateTimeNumber = number;

/**
 * A date or a unix timestamp
 */
export type DateOrUnixDateTimeNumber = Date | UnixDateTimeNumber;

export type Milliseconds = number;
export type Seconds = number;
export type Minutes = number;
export type Hours = number;
export type Days = number;

export const MINUTES_IN_DAY = 1440;
export const MINUTES_IN_HOUR = 60;
export const MS_IN_MINUTE = 1000 * 60;
export const MS_IN_HOUR = MS_IN_MINUTE * 60;
export const MS_IN_DAY = MS_IN_HOUR * 24;
