import { Maybe } from "../value/maybe";

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

export enum TimeAM {
  AM = 'AM',
  PM = 'PM'
}

export type DateNow = 'now';
export const DATE_NOW_VALUE = 'now';

export type LogicalDateStringCode = DateNow;

/**
 * A date that is characterized by either a known string value, or a Date.
 */
export type LogicalDate = Date | LogicalDateStringCode;

/**
 * Returns a Date value from the input LogicalDate.
 * 
 * @param logicalDate 
 */
export function dateFromLogicalDate(logicalDate: Maybe<LogicalDate>): Maybe<Date>;
export function dateFromLogicalDate(logicalDate: LogicalDate): Date;
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
