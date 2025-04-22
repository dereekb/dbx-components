import { type Maybe } from '../value/maybe.type';

/**
 * Represents a string for a time. This may be human-input, and
 * can be interpreted in various ways depending on the input.
 *
 * Examples:
 * - 1:20AM
 * - 1:20
 * - 120AM
 * - 120
 */
export type ReadableTimeString = string;

/**
 * Enumeration of AM/PM time indicators.
 */
export enum TimeAM {
  AM = 'AM',
  PM = 'PM'
}

/**
 * Constant representing the current time/date.
 * Used in logical date calculations to indicate "now".
 */
export const DATE_NOW_VALUE = 'now';
/**
 * Type representing the current date/time value.
 */
export type DateNow = typeof DATE_NOW_VALUE;

/**
 * String codes that represent logical dates, such as 'now'.
 */
export type LogicalDateStringCode = DateNow;

/**
 * A date that is characterized by either a known string value, or a Date.
 */
export type LogicalDate = Date | LogicalDateStringCode;

/**
 * Converts a LogicalDate into an actual Date object.
 * If the LogicalDate is already a Date, it's returned as is.
 * If it's a string code like 'now', it's converted to the appropriate Date value.
 *
 * @param logicalDate - A LogicalDate value to convert (Date object or string code)
 * @returns A Date object representing the logical date, or null/undefined if input was null/undefined
 */
export function dateFromLogicalDate(logicalDate: LogicalDate): Date;
export function dateFromLogicalDate(logicalDate: Maybe<LogicalDate>): Maybe<Date>;
export function dateFromLogicalDate(logicalDate: Maybe<LogicalDate>): Maybe<Date> {
  let result;

  if (typeof logicalDate === 'string') {
    switch (logicalDate.toLocaleLowerCase()) {
      case DATE_NOW_VALUE:
        result = new Date();
        break;
      default:
        throw new Error(`Unknown logical date string "${logicalDate}"`);
    }
  } else {
    result = logicalDate;
  }

  return result;
}

/**
 * Determines if the input value is a recognized LogicalDateStringCode.
 * Currently, only the 'now' value is recognized as a LogicalDateStringCode.
 *
 * @param logicalDate - The value to check
 * @returns True if the value is a recognized LogicalDateStringCode
 */
export function isLogicalDateStringCode(logicalDate: Maybe<string | LogicalDate>): logicalDate is LogicalDateStringCode {
  let isLogicalDateStringCode = false;

  if (typeof logicalDate === 'string') {
    switch (logicalDate.toLocaleLowerCase()) {
      case DATE_NOW_VALUE:
        isLogicalDateStringCode = true;
        break;
    }
  }

  return isLogicalDateStringCode;
}
