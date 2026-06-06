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
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic string
 */
export type RFC3339DateString = string;

/**
 * A valid ISO8601 formatted date string.
 *
 * I.E. "2020-04-30T00:00:00.000Z"
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic string
 */
export type ISO8601DateString = string;

/**
 * Regular expression for validating ISO8601 date strings.
 *
 * TODO(FUTURE): Need to improve to support negative years.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, iso8601, regex, string, validate
 * @dbxUtilRelated is-iso8601-date-string, iso8601-day-string-regex
 */
export const ISO_8601_DATE_STRING_REGEX = /(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-](\d{2}):(\d{2}))?/;

/**
 * Determines if a string is a valid ISO8601 date string.
 *
 * @param input - Value to test against the ISO8601 date string pattern.
 * @returns True when the input matches the canonical ISO8601 date layout.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, iso8601, string, predicate, validate
 * @dbxUtilRelated is-iso8601-day-string, is-utc-date-string, iso-8601-date-string-regex
 */
export function isISO8601DateString(input: string): input is ISO8601DateString {
  return ISO_8601_DATE_STRING_REGEX.test(input);
}

/**
 * A UTC date string.
 *
 * I.E. "Sat, 03 Feb 2001 04:05:06 GMT"
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic string
 */
export type UTCDateString = string;

/**
 * Match examples:
 *
 * Sat, 03 Feb 2001 04:05:06 GMT
 * Tue, 14 Mar 2023 12:34:56 UTC
 * Wed, 25 May 2024 20:45:07 EST
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, utc, regex, string, validate
 * @dbxUtilRelated is-utc-date-string
 */
export const UTC_DATE_STRING_REGEX = /^([a-zA-Z]{3}, \d{2} [a-zA-Z]{3} \d{4} \d{2}:\d{2}:\d{2} [A-Z]{3})$/;

/**
 * Determines if a string is a valid UTC date string.
 *
 * @param input - Value to test against the UTC-formatted date string pattern.
 * @returns True when the input matches the canonical UTC date layout.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, utc, string, predicate, validate
 * @dbxUtilRelated is-iso8601-date-string, utc-date-string-regex
 */
export function isUTCDateString(input: string): boolean {
  return UTC_DATE_STRING_REGEX.test(input);
}

/**
 * A full ISO8601 date string that is in UTC.
 *
 * I.E. "2020-04-30T00:00:00.000Z"
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic string
 */
export type ISO8601DateStringUTCFull = string;

/**
 * A valid timezone string.
 *
 * I.E. "UTC", "America/Denver", etc.
 *
 * @semanticType
 * @semanticTopic timezone
 * @semanticTopic string
 */
export type TimezoneString = string;

/**
 * A timezone abbreviation (UTC, EST, etc).
 *
 * @semanticType
 * @semanticTopic timezone
 * @semanticTopic string
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
 * @param a - First object that may contain a timezone reference.
 * @param b - Second object that may contain a timezone reference.
 * @returns True if both objects have the same timezone or neither has a timezone set.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, timezone, compare, equal, predicate
 * @dbxUtilRelated is-considered-utc-timezone-string
 */
export function hasSameTimezone(a: Maybe<Partial<TimezoneStringRef>>, b: Maybe<Partial<TimezoneStringRef>>): boolean {
  const tzA = a?.timezone;
  const tzB = b?.timezone;
  return valuesAreBothNullishOrEquivalent(tzA, tzB);
}

/**
 * Constant for the UTC timezone string, "UTC".
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, timezone, utc, string, constant
 * @dbxUtilRelated is-considered-utc-timezone-string
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
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, timezone, utc, predicate
 * @dbxUtilRelated has-same-timezone, utc-timezone-string
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
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic string
 */
export type ISO8601DayString = string; // '1921-06-23'

/**
 * A Date or an ISO8601DayString.
 */
export type DateOrDayString = Date | ISO8601DayString;

/**
 * Regex for an ISO8601DayString.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, iso8601, day, regex, string, validate
 * @dbxUtilRelated is-iso8601-day-string, iso8601-day-string-start-regex
 */
export const ISO8601_DAY_STRING_REGEX = /^\d{4,}-\d{2}-\d{2}$/;

/**
 * Regex for a string that starts as an ISO8601DayString.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, iso8601, day, regex, prefix
 * @dbxUtilRelated is-iso8601-day-string-start, iso8601-day-string-regex
 */
export const ISO8601_DAY_STRING_START_REGEX = /^\d{4,}-\d{2}-\d{2}/;

/**
 * Returns the start of the input date's UTC time in UTC.
 *
 * I.E. 2022-01-02T04:00:00.000Z in GMT-6 returns 2022-01-02
 *
 * @param date - Reference instant whose UTC calendar day should be anchored.
 * @returns Midnight UTC of the same UTC day as `date`.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, utc, start-of-day, day, normalize
 * @dbxUtilRelated start-of-day-for-system-date-in-utc, parse-iso8601-day-string-to-utc-date
 */
export function startOfDayForUTCDateInUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
/**
 * Returns the start of the system's local date in UTC.
 *
 * I.E. 2022-01-02T04:00:00.000Z in GMT-6 (10PM Jan 1st CST) returns 2022-01-01
 *
 * @param date - Reference instant whose system-local calendar day should be anchored.
 * @returns Midnight UTC corresponding to the local-time start of `date`.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, utc, start-of-day, system, local
 * @dbxUtilRelated start-of-day-for-utc-date-in-utc
 */
export function startOfDayForSystemDateInUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Parses an ISO8601DayString (YYYY-MM-DD) to a UTC Date at midnight.
 *
 * @param inputDateString - ISO8601 day string to parse (e.g. '2022-01-15').
 * @returns Midnight UTC of the calendar day named by `inputDateString`.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, iso8601, day, parse, utc, convert
 * @dbxUtilRelated is-iso8601-day-string, start-of-day-for-utc-date-in-utc
 */
export function parseISO8601DayStringToUTCDate(inputDateString: ISO8601DayString): Date {
  const [yearString, monthString, dateString] = inputDateString.split('-');
  return new Date(Date.UTC(Number(yearString), Number(monthString) - 1, Number(dateString)));
}

/**
 * Determines if a string is a valid ISO8601 day string (YYYY-MM-DD format).
 *
 * @param input - Value to test against the ISO8601 day-string pattern.
 * @returns True when the input is exactly a YYYY-MM-DD value.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, iso8601, day, string, predicate, validate
 * @dbxUtilRelated is-iso8601-day-string-start, parse-iso8601-day-string-to-utc-date, iso8601-day-string-regex
 */
export function isISO8601DayString(input: string): input is ISO8601DayString {
  return ISO8601_DAY_STRING_REGEX.test(input);
}

/**
 * Determines if a string starts with a valid ISO8601 day string pattern (YYYY-MM-DD).
 *
 * @param input - Value to test for an ISO8601 day-string prefix.
 * @returns True when the input begins with a YYYY-MM-DD prefix.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, iso8601, day, string, predicate, prefix
 * @dbxUtilRelated is-iso8601-day-string, iso8601-day-string-start-regex
 */
export function isISO8601DayStringStart(input: string): input is ISO8601DayString {
  return ISO8601_DAY_STRING_START_REGEX.test(input);
}

/**
 * Date that is represented by slashes. Is considered in the Month/Day/Year format.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic string
 */
export type MonthDaySlashDate = string; // 11/1/2020

/**
 * Regex for a MonthDaySlashDate.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, slash, month, day, regex, string, validate
 * @dbxUtilRelated is-month-day-slash-date
 */
export const MONTH_DAY_SLASH_DATE_STRING_REGEX = /^\d{1,2}\/\d{1,2}\/\d+$/;

/**
 * Determines if a string is a valid Month/Day/Year slash date format.
 *
 * @param input - Value to test against the slash-separated date pattern.
 * @returns True when the input matches the Month/Day/Year slash format.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, slash, month, day, string, predicate, validate
 * @dbxUtilRelated month-day-slash-date-to-date-string, month-day-slash-date-string-regex
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
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, slash, day, string, convert, parse
 * @dbxUtilRelated is-month-day-slash-date
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

  return `${year}-${month}-${day}`;
}

/**
 * Time in milliseconds since the epoch.
 *
 * Returned by Date.getTime().
 *
 * @semanticType
 * @semanticTopic time
 * @semanticTopic numeric
 */
export type UnixDateTimeMillisecondsNumber = number;

/**
 * A date or a unix timestamp (in milliseconds)
 */
export type DateOrUnixDateTimeMillisecondsNumber = Date | UnixDateTimeMillisecondsNumber;

/**
 * Converts a Date object or unix timestamp (in milliseconds) to a Date object.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, milliseconds, unix, convert, normalize
 * @dbxUtilRelated unix-milliseconds-number-to-date, date-or-milliseconds-to-date
 *
 * @param input - Date object or unix timestamp (in milliseconds) to convert
 * @returns Date object if input is valid. Returns null/undefined if input is null/undefined
 */
export function dateFromDateOrTimeMillisecondsNumber(input: DateOrUnixDateTimeMillisecondsNumber): Date;
export function dateFromDateOrTimeMillisecondsNumber(input: MaybeNot): MaybeNot;
export function dateFromDateOrTimeMillisecondsNumber(input: Maybe<DateOrUnixDateTimeMillisecondsNumber>): Maybe<Date>;
export function dateFromDateOrTimeMillisecondsNumber(input: Maybe<DateOrUnixDateTimeMillisecondsNumber>): Maybe<Date> {
  let result: Maybe<Date>;

  if (input == null) {
    result = input;
  } else if (isDate(input)) {
    result = input;
  } else {
    result = unixMillisecondsNumberToDate(input);
  }

  return result;
}

/**
 * Converts a unix timestamp number to a Date object.
 *
 * @param dateTimeNumber - Unix timestamp number to convert.
 * @returns Date object if timestamp is valid, null/undefined if timestamp is null/undefined.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, milliseconds, unix, convert, parse
 * @dbxUtilRelated date-from-date-or-time-milliseconds-number, unix-date-time-seconds-number-to-date
 */
export function unixMillisecondsNumberToDate(dateTimeNumber: Maybe<UnixDateTimeMillisecondsNumber>): Maybe<Date> {
  return dateTimeNumber == null ? dateTimeNumber : new Date(dateTimeNumber);
}

/**
 * Number of milliseconds.
 *
 * @semanticType
 * @semanticTopic time
 * @semanticTopic duration
 * @semanticTopic numeric
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
 * @param dateOrMilliseconds - Either a concrete Date or a millisecond offset from `now`.
 * @param now - Anchor used to resolve a millisecond offset; defaults to the current time.
 * @returns Resolved Date for either a direct value or the offset-from-now case.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, milliseconds, convert, normalize, offset
 * @dbxUtilRelated add-milliseconds, date-from-date-or-time-milliseconds-number
 */
export function dateOrMillisecondsToDate(dateOrMilliseconds: DateOrMilliseconds, now?: Maybe<Date>): Date {
  return isDate(dateOrMilliseconds) ? dateOrMilliseconds : addMilliseconds(now ?? new Date(), dateOrMilliseconds);
}

/**
 * Number of seconds.
 *
 * @semanticType
 * @semanticTopic time
 * @semanticTopic duration
 * @semanticTopic numeric
 */
export type Seconds = number;

/**
 * Number of minutes.
 *
 * @semanticType
 * @semanticTopic time
 * @semanticTopic duration
 * @semanticTopic numeric
 */
export type Minutes = number;

/**
 * Number of hours.
 *
 * @semanticType
 * @semanticTopic time
 * @semanticTopic duration
 * @semanticTopic numeric
 */
export type Hours = number;

/**
 * Number of days.
 *
 * @semanticType
 * @semanticTopic time
 * @semanticTopic duration
 * @semanticTopic numeric
 */
export type Days = number;

/**
 * Number of days in a year (ignoring leap years, which are 366 days).
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, day, year, duration, constant
 * @dbxUtilRelated days-in-week
 */
export const DAYS_IN_YEAR: Days = 365;

/**
 * Number of hours in a day.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, hour, day, duration, constant
 * @dbxUtilRelated minutes-in-day, ms-in-day
 */
export const HOURS_IN_DAY: Hours = 24;

/**
 * Number of seconds in a minute.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, second, minute, duration, constant
 * @dbxUtilRelated seconds-in-hour, ms-in-second
 */
export const SECONDS_IN_MINUTE: Seconds = 60;

/**
 * Number of minutes in a day.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, minute, day, duration, constant
 * @dbxUtilRelated hours-in-day, minutes-in-hour
 */
export const MINUTES_IN_DAY: Minutes = 1440;

/**
 * Number of minutes in an hour.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, minute, hour, duration, constant
 * @dbxUtilRelated minutes-in-day, seconds-in-minute
 */
export const MINUTES_IN_HOUR: Minutes = 60;

/**
 * Number of seconds in an hour.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, second, hour, duration, constant
 * @dbxUtilRelated seconds-in-minute, minutes-in-hour
 */
export const SECONDS_IN_HOUR: Minutes = MINUTES_IN_HOUR * SECONDS_IN_MINUTE;

/**
 * Number of milliseconds in a second.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, milliseconds, second, duration, constant
 * @dbxUtilRelated ms-in-minute, seconds-in-minute
 */
export const MS_IN_SECOND: Milliseconds = 1000;

/**
 * Number of milliseconds in a minute.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, milliseconds, minute, duration, constant
 * @dbxUtilRelated ms-in-second, ms-in-hour
 */
export const MS_IN_MINUTE: Milliseconds = MS_IN_SECOND * 60;

/**
 * Number of milliseconds in an hour.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, milliseconds, hour, duration, constant
 * @dbxUtilRelated ms-in-minute, ms-in-day
 */
export const MS_IN_HOUR: Milliseconds = MS_IN_MINUTE * 60;

/**
 * Number of milliseconds in a day.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, milliseconds, day, duration, constant
 * @dbxUtilRelated ms-in-hour, ms-in-week, hours-in-day
 */
export const MS_IN_DAY: Milliseconds = MS_IN_HOUR * HOURS_IN_DAY;

/**
 * Number of seconds in a day.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, seconds, day, duration, constant
 * @dbxUtilRelated seconds-in-hour, seconds-in-week
 */
export const SECONDS_IN_DAY: Seconds = SECONDS_IN_HOUR * HOURS_IN_DAY;

/**
 * Number of days in a week.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, day, week, duration, constant
 * @dbxUtilRelated ms-in-week, days-in-year
 */
export const DAYS_IN_WEEK: Days = 7;

/**
 * Number of milliseconds in a week.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilKind const
 * @dbxUtilTags date, milliseconds, week, duration, constant
 * @dbxUtilRelated ms-in-day, days-in-week
 */
export const MS_IN_WEEK: Milliseconds = MS_IN_DAY * DAYS_IN_WEEK;

/**
 * Day of the month, 1-31
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type DayOfMonth = number;

/**
 * Month of the year, 1-12.
 *
 * NOTE: The month from Date.getMonth() is from 0-11. Use monthOfYearFromDate() to get the MonthOfYear value.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type MonthOfYear = number;

/**
 * Javascript Date month number. 0-11.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type DateMonth = number;

/**
 * Retrieves the MonthOfYear value (1-12) from the input Date in the current system timezone.
 *
 * Converts JavaScript's 0-based month (0-11) to a 1-based month (1-12).
 *
 * @param date - Reference instant whose local month should be reported.
 * @returns One-based local month-of-year, ready for human-facing display.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, month, year, accessor, system, local
 * @dbxUtilRelated month-of-year-from-date-month, month-of-year-from-utc-date
 */
export function monthOfYearFromDate(date: Date): MonthOfYear {
  return monthOfYearFromDateMonth(date.getMonth());
}

/**
 * Retrieves the MonthOfYear value (1-12) from the input Date in the UTC timezone.
 *
 * Converts JavaScript's 0-based month (0-11) to a 1-based month (1-12).
 *
 * @param date - Reference instant whose UTC month should be reported.
 * @returns One-based UTC month-of-year, ready for human-facing display.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, month, year, accessor, utc
 * @dbxUtilRelated month-of-year-from-date, month-of-year-from-date-month
 */
export function monthOfYearFromUTCDate(date: Date): MonthOfYear {
  return monthOfYearFromDateMonth(date.getUTCMonth());
}

/**
 * Converts a JavaScript Date month (0-11) to a MonthOfYear (1-12).
 *
 * @param dateMonth - JavaScript Date month (0-11)
 * @returns The month of year as a number from 1-12.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, month, year, convert, javascript
 * @dbxUtilRelated make-date-month-for-month-of-year, month-of-year-from-date
 */
export function monthOfYearFromDateMonth(dateMonth: DateMonth): MonthOfYear {
  return dateMonth + 1;
}

/**
 * Converts a MonthOfYear (1-12) to a JavaScript Date month (0-11).
 *
 * @param monthOfYear - Month of year (1-12)
 * @returns JavaScript Date month (0-11)
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, month, convert, javascript
 * @dbxUtilRelated month-of-year-from-date-month, month-of-year-from-date
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeDateMonthForMonthOfYear(monthOfYear: MonthOfYear): DateMonth {
  return monthOfYear - 1;
}

/**
 * Year number. I.E. 2022
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
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
 * @param value - The value to check.
 * @returns True if the value is a Date object.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, predicate, type-guard, validate
 * @dbxUtilRelated is-equal-date, is-past
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date || (typeof value === 'object' && Object.prototype.toString.call(value) === '[object Date]');
}

/**
 * Returns true if the two input dates represent the same point in time.
 * Compares the timestamp values rather than the object references.
 *
 * @param a - First date to compare.
 * @param b - Second date to compare.
 * @returns True if the dates represent the same point in time.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, equal, compare, predicate
 * @dbxUtilRelated is-date, is-past
 */
export function isEqualDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * Returns true if the input date is in the past relative to the current time.
 *
 * @param input - Instant to compare against the system clock.
 * @returns True when `input` is strictly before the current time.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, past, compare, predicate, time
 * @dbxUtilRelated is-equal-date, is-date
 */
export function isPast(input: Date): boolean {
  return input.getTime() < Date.now();
}

/**
 * Adds milliseconds to the input date, returning a new Date object.
 * If no date is input, then returns the input unchanged.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, milliseconds, add, offset, time
 * @dbxUtilRelated date-or-milliseconds-to-date, ms-in-second
 *
 * @param input - The date to add milliseconds to
 * @param ms - The number of milliseconds to add (defaults to 0 if null or undefined)
 * @returns A new Date with the added milliseconds, or the original input if not a Date
 */
export function addMilliseconds(input: Date, ms: Maybe<Milliseconds>): Date;
export function addMilliseconds(input: MaybeNot, ms: Maybe<Milliseconds>): MaybeNot;
export function addMilliseconds(input: Maybe<Date>, ms: Maybe<Milliseconds>): Maybe<Date>;
export function addMilliseconds(input: Maybe<Date>, ms: Maybe<Milliseconds>): Maybe<Date> {
  return input == null ? input : new Date(input.getTime() + (ms ?? 0));
}
