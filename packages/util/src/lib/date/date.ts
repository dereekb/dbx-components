import { Maybe } from '../value/maybe.type';

/**
 * A valid ISO8601 formatted date string.
 *
 * I.E. "2020-04-30T00:00:00.000Z"
 */
export type ISO8601DateString = string;

export const ISO_8601_DATE_STRING_REGEX = /(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})(Z|[+-](\d{2})\:(\d{2}))?/;

export function isISO8601DateString(input: string): input is ISO8601DateString {
  return ISO_8601_DATE_STRING_REGEX.test(input);
}

/**
 * A UTC date string.
 *
 * I.E. "Sat, 03 Feb 2001 04:05:06 GMT"
 */
export type UTCDateString = string;

/**
 * Match examples:
 *
 * Sat, 03 Feb 2001 04:05:06 GMT
 * Tue, 14 Mar 2023 12:34:56 UTC
 * Wed, 25 May 2024 20:45:07 EST
 */
export const UTC_DATE_STRING_REGEX = /^([a-zA-Z]{3}, [0-9]{2} [a-zA-Z]{3} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} [A-Z]{3})$/;

export function isUTCDateString(input: string): boolean {
  return UTC_DATE_STRING_REGEX.test(input);
}

/**
 * A full ISO8601 date string that is in UTC.
 *
 * I.E. "2020-04-30T00:00:00.000Z"
 */
export type ISO8601DateStringUTCFull = string;

/**
 * A valid timezone string.
 */
export type TimezoneString = string;

/**
 * A timezone abbreviation (UTC, EST, etc).
 */
export type TimezoneAbbreviation = string;

/**
 * Object that references a TimezoneString.
 */
export interface TimezoneStringRef {
  timezone: TimezoneString;
}

export const UTC_TIMEZONE_STRING = 'UTC';

/**
 * UTC
 */
export type UTCTimezoneAbbreviation = typeof UTC_TIMEZONE_STRING;

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
export type MonthDaySlashDate = string; // 11/1/2020

/**
 * Regex for a MonthDaySlashDate.
 */
export const MONTH_DAY_SLASH_DATE_STRING_REGEX = /^\d{1,2}\/\d{1,2}\/\d+$/;

export function isMonthDaySlashDate(input: string): input is MonthDaySlashDate {
  return MONTH_DAY_SLASH_DATE_STRING_REGEX.test(input);
}

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

export const HOURS_IN_DAY = 24;
export const SECONDS_IN_MINUTE = 60;
export const MINUTES_IN_DAY = 1440;
export const MINUTES_IN_HOUR = 60;
export const MS_IN_MINUTE = 1000 * 60;
export const MS_IN_HOUR = MS_IN_MINUTE * 60;
export const MS_IN_DAY = MS_IN_HOUR * HOURS_IN_DAY;

/**
 * Day of the month, 1-31
 */
export type DayOfMonth = number;

/**
 * Month of the year, 1-12.
 *
 * NOTE: The month from Date.getMonth() is from 0-11. Use monthOfYearFromDate() to get the MonthOfYear value.
 */
export type MonthOfYear = number;

/**
 * Javascript Date month number. 0-11.
 */
export type DateMonth = number;

/**
 * Retrieves the MonthOfYear value from the input Date.
 *
 * @param date
 * @returns
 */
export function monthOfYearFromDate(date: Date): MonthOfYear {
  return monthOfYearFromDateMonth(date.getMonth());
}

export function monthOfYearFromDateMonth(dateMonth: DateMonth): MonthOfYear {
  return dateMonth + 1;
}

export function makeDateMonthForMonthOfYear(monthOfYear: MonthOfYear): DateMonth {
  return monthOfYear - 1;
}

/**
 * Year number. I.E. 2022
 */
export type YearNumber = number;

/**
 * Current state of the date relative to another date.
 */
export type DateRelativeState = 'past' | 'present' | 'future';
