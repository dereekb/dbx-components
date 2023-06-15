import { DATE_NOW_VALUE, DateNow, Maybe } from '@dereekb/util';
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';

export const DATE_TODAY_START_VALUE = 'today_start';
export type DateTodayStart = typeof DATE_TODAY_START_VALUE;

export const DATE_TODAY_END_VALUE = 'today_end';
export type DateTodayEnd = typeof DATE_TODAY_END_VALUE;

export const DATE_WEEK_START_VALUE = 'this_week_start';
export type DateWeekStart = typeof DATE_WEEK_START_VALUE;

export const DATE_WEEK_END_VALUE = 'this_week_end';
export type DateWeekEnd = typeof DATE_WEEK_END_VALUE;

export type LogicalDateStringCode = DateNow | DateTodayStart | DateTodayEnd | DateWeekStart | DateWeekEnd;

/**
 * A date that is characterized by either a known string value, or a Date.
 */
export type LogicalDate = Date | LogicalDateStringCode;

/**
 * Returns a Date value from the input LogicalDate.
 *
 * @param logicalDate
 */
export function dateFromLogicalDate(logicalDate: LogicalDate, now?: Date): Date;
export function dateFromLogicalDate(logicalDate: Maybe<LogicalDate>, now?: Date): Maybe<Date>;
export function dateFromLogicalDate(logicalDate: Maybe<LogicalDate>, now: Date = new Date()): Maybe<Date> {
  let result;

  if (typeof logicalDate === 'string') {
    switch (logicalDate.toLocaleLowerCase()) {
      case DATE_NOW_VALUE:
        result = now;
        break;
      case DATE_TODAY_START_VALUE:
        result = startOfDay(now);
        break;
      case DATE_TODAY_END_VALUE:
        result = endOfDay(now);
        break;
      case DATE_WEEK_START_VALUE:
        result = startOfWeek(now);
        break;
      case DATE_WEEK_END_VALUE:
        result = endOfWeek(now);
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
      case DATE_TODAY_START_VALUE:
      case DATE_TODAY_END_VALUE:
      case DATE_WEEK_START_VALUE:
      case DATE_WEEK_END_VALUE:
        isLogicalDateStringCode = true;
        break;
    }
  }

  return isLogicalDateStringCode;
}
