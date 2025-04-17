import { valuesAreBothNullishOrEquivalent } from '../value/maybe';
import { type MaybeNot, type Maybe } from '../value/maybe.type';

/**
 * The past or future direction.
 */
export type DateRelativeDirection = 'past' | 'future';

/**
 * Hour, minute, or second as a string.
 */
export type DateHourMinuteOrSecond = 'hour' | 'minute' | 'second';

/**
 * A valid RFC3339 formatted date string.
 *
 * I.E. "2020-04-30 00:00:00.000Z" and "2020-04-30T00:00:00.000Z"
 *
 * The only difference between this and an ISO8601DateString is the spacing between the date and time is allowed, while in ISO8601DateString it is not.
 */
export type RFC3339DateString = string;

/**
 * A valid ISO8601 formatted date string.
 *
 * I.E. "2020-04-30T00:00:00.000Z"
 */
export type ISO8601DateString = string;

/**
 * TODO(FUTURE): Need to improve to support negative years.
 */
export const ISO_8601_DATE_STRING_REGEX = /(\d{4,})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})(Z|[+-](\d{2})\:(\d{2}))?/;

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
 *
 * I.E. "UTC", "America/Denver", etc.
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

/**
 * Returns true only if the inputs have the same timezone, or both do not have a timezone set.
 *
 * @param a
 * @param b
 * @returns
 */
export function hasSameTimezone(a: Maybe<Partial<TimezoneStringRef>>, b: Maybe<Partial<TimezoneStringRef>>): boolean {
  const tzA = a?.timezone;
  const tzB = b?.timezone;
  return valuesAreBothNullishOrEquivalent(tzA, tzB);
}

/**
 * Constant for the UTC timezone string, "UTC".
 */
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
 * A full date string Formatted as ISO8601 with 4 digits for the year.
 *
 * Year, Month, Day
 *
 * I.E. 1921-06-23
 *
 * NOTE: Negative years and years with more than 4 digits are not supported/expected. Support can be added later, but will require adding a more complex regex, and improved parsing in @dereekb/date
 */
export type ISO8601DayString = string; // '1921-06-23'

/**
 * A Date or an ISO8601DayString.
 */
export type DateOrDayString = Date | ISO8601DayString;

/**
 * Regex for an ISO8601DayString.
 */
export const ISO8601_DAY_STRING_REGEX = /^\d{4,}-\d{2}-\d{2}$/;

/**
 * Regex for a string that starts as an ISO8601DayString.
 */
export const ISO8601_DAY_STRING_START_REGEX = /^\d{4,}-\d{2}-\d{2}/;

/**
 * Returns the start of the input date's UTC time in UTC.
 *
 * I.E. 2022-01-02T04:00:00.000Z in GMT-6 returns 2022-01-02
 *
 * @param date
 * @returns
 */
export function startOfDayForUTCDateInUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
/**
 * Returns the system's date in UTC.
 *
 * I.E. 2022-01-02T04:00:00.000Z in GMT-6 (10PM Jan 1st CST) returns 2022-01-01
 *
 * @param date
 * @returns
 */
export function startOfDayForSystemDateInUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Parses a ISO8601DayString to a Date.
 *
 * @param inputDateString
 * @returns
 */
export function parseISO8601DayStringToUTCDate(inputDateString: ISO8601DayString): Date {
  const [yearString, monthString, dateString] = inputDateString.split('-');
  return new Date(Date.UTC(Number(yearString), Number(monthString) - 1, Number(dateString)));
}

/**
 * Returns true if the input date is strictly a
 * @param input
 * @returns
 */
export function isISO8601DayString(input: string): input is ISO8601DayString {
  return ISO8601_DAY_STRING_REGEX.test(input);
}

export function isISO8601DayStringStart(input: string): input is ISO8601DayString {
  return ISO8601_DAY_STRING_START_REGEX.test(input);
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
 *
 * Returned by Date.getTime().
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
export const MS_IN_SECOND = 1000;
export const MS_IN_MINUTE = MS_IN_SECOND * 60;
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
export type DateRelativeState = DateRelativeDirection | 'present';

/**
 * Returns true if the value is a date.
 *
 * @param value
 * @returns
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date || (typeof value === 'object' && Object.prototype.toString.call(value) === '[object Date]');
}

/**
 * Returns true if the two input dates are equal.
 *
 * @param a
 * @param b
 * @returns
 */
export function isEqualDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * Returns true if the input date is in the past.
 *
 * @param input
 * @returns
 */
export function isPast(input: Date): boolean {
  return input.getTime() < Date.now();
}

/**
 * Adds milliseconds to the input date.
 *
 * If no date is input, then returns the input.
 *
 * @param input
 * @param ms
 */
export function addMilliseconds(input: Date, ms: Maybe<Milliseconds>): Date;
export function addMilliseconds(input: MaybeNot, ms: Maybe<Milliseconds>): MaybeNot;
export function addMilliseconds(input: Maybe<Date>, ms: Maybe<Milliseconds>): Maybe<Date>;
export function addMilliseconds(input: Maybe<Date>, ms: Maybe<Milliseconds>): Maybe<Date> {
  return input != null ? new Date(input.getTime() + (ms ?? 0)) : input;
}
