import { Maybe } from "../value";

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
  return (timezone == null || timezone === UTC_TIMEZONE_STRING);
}

/**
 * A Date or an ISO8601DateString.
 */
export type DateOrDateString = Date | ISO8601DateString;

/**
 * A full date string Formatted as ISO8601.
 * 
 * I.E. 1921-06-23
 */
export type ISO8601DayString = string; // '1921-06-23'

/**
 * Time in seconds (instead of ms) since the epoch.
 */
export type UnixDateTimeNumber = number;

/**
 * A date or a unix timestamp
 */
export type DateOrUnixDateTimeNumber = Date | UnixDateTimeNumber;

export type Seconds = number;
export type Minutes = number;
export type Hours = number;
export type Days = number;

export const MINUTES_IN_DAY = 1440;
export const MS_IN_MINUTE = 1000 * 60;
export const MS_IN_HOUR = MS_IN_MINUTE * 60;
