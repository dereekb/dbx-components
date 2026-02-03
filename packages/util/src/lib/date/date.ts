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
 * Regular expression for validating ISO8601 date strings.
 *
 * TODO(FUTURE): Need to improve to support negative years.
 */
export const ISO_8601_DATE_STRING_REGEX = /(\d{4,})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})(Z|[+-](\d{2})\:(\d{2}))?/;

/**
 * Determines if a string is a valid ISO8601 date string.
 *
 * @param input - The string to test
 * @returns True if the input is a valid ISO8601 date string
 */
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

/**
 * Determines if a string is a valid UTC date string.
 *
 * @param input - The string to test
 * @returns True if the input is a valid UTC date string
 */
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
 * @param a - First object that may contain a timezone reference
 * @param b - Second object that may contain a timezone reference
 * @returns True if both objects have the same timezone or neither has a timezone set
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
 * Determines whether the input timezone string is considered UTC.
 * Returns true for null, undefined, or the string 'UTC'.
 *
 * @param timezone - The timezone string to check
 * @returns True if the timezone is considered UTC
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
/**
 * Determines if a string is a valid ISO8601 day string (YYYY-MM-DD format).
 *
 * @param input - The string to test
 * @returns True if the input is a valid ISO8601 day string
 */
export function isISO8601DayString(input: string): input is ISO8601DayString {
  return ISO8601_DAY_STRING_REGEX.test(input);
}

/**
 * Determines if a string starts with a valid ISO8601 day string pattern (YYYY-MM-DD).
 *
 * @param input - The string to test
 * @returns True if the input starts with a valid ISO8601 day string pattern
 */
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

/**
 * Determines if a string is a valid Month/Day/Year slash date format.
 *
 * @param input - The string to test
 * @returns True if the input is a valid Month/Day/Year slash date
 */
export function isMonthDaySlashDate(input: string): input is MonthDaySlashDate {
  return MONTH_DAY_SLASH_DATE_STRING_REGEX.test(input);
}

/**
 * Converts the input MonthDaySlashDate (MM/DD/YYYY) to an ISO8601DayString (YYYY-MM-DD).
 * Handles single digit months and days by adding leading zeros.
 * If year is only 2 digits, prepends '20' to make a 4-digit year.
 *
 * @param slashDate - The slash date string to convert (e.g., '1/1/20' or '11/15/2022')
 * @returns An ISO8601 formatted day string (YYYY-MM-DD)
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
 * Time in milliseconds since the epoch.
 *
 * Returned by Date.getTime().
 */
export type UnixDateTimeMillisecondsNumber = number;

/**
 * A date or a unix timestamp (in milliseconds)
 */
export type DateOrUnixDateTimeMillisecondsNumber = Date | UnixDateTimeMillisecondsNumber;

/**
 * Converts a Date object or unix timestamp (in milliseconds) to a Date object.
 *
 * @param input - Date object or unix timestamp (in milliseconds) to convert
 * @returns Date object if input is valid. Returns null/undefined if input is null/undefined
 */
export function dateFromDateOrTimeMillisecondsNumber(input: DateOrUnixDateTimeMillisecondsNumber): Date;
export function dateFromDateOrTimeMillisecondsNumber(input: MaybeNot): MaybeNot;
export function dateFromDateOrTimeMillisecondsNumber(input: Maybe<DateOrUnixDateTimeMillisecondsNumber>): Maybe<Date>;
export function dateFromDateOrTimeMillisecondsNumber(input: Maybe<DateOrUnixDateTimeMillisecondsNumber>): Maybe<Date> {
  if (input == null) {
    return input as null | undefined;
  } else if (isDate(input)) {
    return input as Date;
  } else {
    return unixMillisecondsNumberToDate(input as UnixDateTimeMillisecondsNumber);
  }
}

/**
 * Converts a unix timestamp number to a Date object.
 *
 * @param dateTimeNumber - Unix timestamp number to convert
 * @returns Date object if timestamp is valid, null/undefined if timestamp is null/undefined
 */
export function unixMillisecondsNumberToDate(dateTimeNumber: Maybe<UnixDateTimeMillisecondsNumber>): Maybe<Date> {
  return dateTimeNumber != null ? new Date(dateTimeNumber) : (dateTimeNumber as null | undefined);
}

/**
 * Number of milliseconds.
 */
export type Milliseconds = number;

/**
 * A date or a number of milliseconds.
 */
export type DateOrMilliseconds = Date | Milliseconds;

/**
 * Converts the input DateOrMilliseconds to a Date.
 *
 * If the input is a Date, it is returned as is.
 *
 * If the input is a number of milliseconds, it is added to the current date.
 *
 * @param dateOrMilliseconds - The date or milliseconds to convert to a Date.
 * @param now - The current date to use when adding milliseconds. Defaults to the current time.
 * @returns The Date representation of the input.
 */
export function dateOrMillisecondsToDate(dateOrMilliseconds: DateOrMilliseconds, now?: Maybe<Date>): Date {
  return isDate(dateOrMilliseconds) ? dateOrMilliseconds : addMilliseconds(now ?? new Date(), dateOrMilliseconds);
}

/**
 * Number of seconds.
 */
export type Seconds = number;

/**
 * Number of minutes.
 */
export type Minutes = number;

/**
 * Number of hours.
 */
export type Hours = number;

/**
 * Number of days.
 */
export type Days = number;

/**
 * Number of days in a year (ignoring leap years, which are 366 days).
 */
export const DAYS_IN_YEAR: Days = 365;

/**
 * Number of hours in a day.
 */
export const HOURS_IN_DAY: Hours = 24;

/**
 * Number of seconds in a minute.
 */
export const SECONDS_IN_MINUTE: Seconds = 60;

/**
 * Number of minutes in a day.
 */
export const MINUTES_IN_DAY: Minutes = 1440;

/**
 * Number of minutes in an hour.
 */
export const MINUTES_IN_HOUR: Minutes = 60;

/**
 * Number of milliseconds in a second.
 */
export const MS_IN_SECOND: Milliseconds = 1000;

/**
 * Number of milliseconds in a minute.
 */
export const MS_IN_MINUTE: Milliseconds = MS_IN_SECOND * 60;

/**
 * Number of milliseconds in an hour.
 */
export const MS_IN_HOUR: Milliseconds = MS_IN_MINUTE * 60;

/**
 * Number of milliseconds in a day.
 */
export const MS_IN_DAY: Milliseconds = MS_IN_HOUR * HOURS_IN_DAY;

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
 * Retrieves the MonthOfYear value (1-12) from the input Date in the current system timezone.
 *
 * Converts JavaScript's 0-based month (0-11) to a 1-based month (1-12).
 *
 * @param date - The date to extract the month from
 * @returns The month of year as a number from 1-12
 */
export function monthOfYearFromDate(date: Date): MonthOfYear {
  return monthOfYearFromDateMonth(date.getMonth());
}

/**
 * Retrieves the MonthOfYear value (1-12) from the input Date in the UTC timezone.
 *
 * Converts JavaScript's 0-based month (0-11) to a 1-based month (1-12).
 *
 * @param date - The date to extract the month from
 * @returns The month of year as a number from 1-12
 */
export function monthOfYearFromUTCDate(date: Date): MonthOfYear {
  return monthOfYearFromDateMonth(date.getUTCMonth());
}

/**
 * Converts a JavaScript Date month (0-11) to a MonthOfYear (1-12).
 *
 * @param dateMonth - JavaScript Date month (0-11)
 * @returns The month of year as a number from 1-12
 */
export function monthOfYearFromDateMonth(dateMonth: DateMonth): MonthOfYear {
  return dateMonth + 1;
}

/**
 * Converts a MonthOfYear (1-12) to a JavaScript Date month (0-11).
 *
 * @param monthOfYear - Month of year (1-12)
 * @returns JavaScript Date month (0-11)
 */
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
 * Returns true if the value is a Date object.
 * Uses both instanceof and Object.prototype.toString for reliable type checking.
 *
 * @param value - The value to check
 * @returns True if the value is a Date object
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date || (typeof value === 'object' && Object.prototype.toString.call(value) === '[object Date]');
}

/**
 * Returns true if the two input dates represent the same point in time.
 * Compares the timestamp values rather than the object references.
 *
 * @param a - First date to compare
 * @param b - Second date to compare
 * @returns True if the dates represent the same point in time
 */
export function isEqualDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * Returns true if the input date is in the past relative to the current time.
 *
 * @param input - The date to check
 * @returns True if the date is in the past
 */
export function isPast(input: Date): boolean {
  return input.getTime() < Date.now();
}

/**
 * Adds milliseconds to the input date, returning a new Date object.
 * If no date is input, then returns the input unchanged.
 *
 * @param input - The date to add milliseconds to
 * @param ms - The number of milliseconds to add (defaults to 0 if null or undefined)
 * @returns A new Date with the added milliseconds, or the original input if not a Date
 */
export function addMilliseconds(input: Date, ms: Maybe<Milliseconds>): Date;
export function addMilliseconds(input: MaybeNot, ms: Maybe<Milliseconds>): MaybeNot;
export function addMilliseconds(input: Maybe<Date>, ms: Maybe<Milliseconds>): Maybe<Date>;
export function addMilliseconds(input: Maybe<Date>, ms: Maybe<Milliseconds>): Maybe<Date> {
  return input != null ? new Date(input.getTime() + (ms ?? 0)) : input;
}

// MARK: Compat
/**
 * @deprecated use UnixDateTimeMillisecondsNumber instead.
 */
export type UnixDateTimeNumber = UnixDateTimeMillisecondsNumber;

/**
 * @deprecated use DateOrUnixDateTimeMillisecondsNumber instead.
 */
export type DateOrUnixDateTimeNumber = DateOrUnixDateTimeMillisecondsNumber;
