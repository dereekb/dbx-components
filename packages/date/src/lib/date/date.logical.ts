import { DATE_NOW_VALUE, type DateNow, type Maybe, type FactoryWithInput, type MapFunction, mapIdentityFunction } from '@dereekb/util';
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';

/**
 * String code for the start of the current day.
 */
export const DATE_TODAY_START_VALUE = 'today_start';
export type DateTodayStart = typeof DATE_TODAY_START_VALUE;

/**
 * String code for the end of the current day.
 */
export const DATE_TODAY_END_VALUE = 'today_end';
export type DateTodayEnd = typeof DATE_TODAY_END_VALUE;

/**
 * String code for the start of the current week.
 */
export const DATE_WEEK_START_VALUE = 'this_week_start';
export type DateWeekStart = typeof DATE_WEEK_START_VALUE;

/**
 * String code for the end of the current week.
 */
export const DATE_WEEK_END_VALUE = 'this_week_end';
export type DateWeekEnd = typeof DATE_WEEK_END_VALUE;

/**
 * Union of all recognized logical date string codes.
 */
export type LogicalDateStringCode = DateNow | DateTodayStart | DateTodayEnd | DateWeekStart | DateWeekEnd;

/**
 * A date that is characterized by either a known string code or a concrete Date value.
 *
 * Used to express relative date references (e.g. "today_start") that resolve at evaluation time.
 */
export type LogicalDate = Date | LogicalDateStringCode;

/**
 * Creates a factory function that resolves a {@link LogicalDateStringCode} to a concrete Date relative to an input reference date.
 *
 * @param logicalDateStringCode - the logical date code to resolve
 * @returns a factory that accepts an optional reference date and returns the resolved Date
 * @throws {Error} when the input code is not a recognized {@link LogicalDateStringCode}
 *
 * @example
 * ```ts
 * const factory = logicalDateStringCodeDateFactory('today_start');
 * const startOfToday = factory(new Date('2024-06-15T14:30:00Z'));
 * // startOfToday is 2024-06-15T00:00:00 in the system timezone
 * ```
 */
export function logicalDateStringCodeDateFactory(logicalDateStringCode: LogicalDateStringCode): FactoryWithInput<Date, Date> {
  let mapFn: MapFunction<Date, Date>;

  switch (logicalDateStringCode.toLocaleLowerCase()) {
    case DATE_NOW_VALUE:
      mapFn = mapIdentityFunction();
      break;
    case DATE_TODAY_START_VALUE:
      mapFn = startOfDay;
      break;
    case DATE_TODAY_END_VALUE:
      mapFn = endOfDay;
      break;
    case DATE_WEEK_START_VALUE:
      mapFn = startOfWeek;
      break;
    case DATE_WEEK_END_VALUE:
      mapFn = endOfWeek;
      break;
    default:
      throw new Error(`Unknown logical date string "${logicalDateStringCode}"`);
  }

  return (now: Date = new Date()) => mapFn(now);
}

/**
 * Resolves a {@link LogicalDate} to a concrete Date value.
 *
 * If the input is a string code, it is resolved relative to the given reference date (or now).
 * If the input is already a Date, it is returned as-is.
 *
 * @param logicalDate - the logical date to resolve (string code or Date)
 * @param now - optional reference date (defaults to current time)
 * @returns the resolved Date, or undefined/null if input is nullish
 *
 * @example
 * ```ts
 * const date = dateFromLogicalDate('today_end', new Date('2024-06-15T10:00:00Z'));
 * // date is end of day 2024-06-15 in the system timezone
 *
 * const same = dateFromLogicalDate(new Date('2024-01-01'));
 * // same is the exact Date passed in
 * ```
 */
export function dateFromLogicalDate(logicalDate: LogicalDate, now?: Date): Date;
export function dateFromLogicalDate(logicalDate: Maybe<LogicalDate>, now?: Date): Maybe<Date>;
export function dateFromLogicalDate(logicalDate: Maybe<LogicalDate>, now: Date = new Date()): Maybe<Date> {
  let result;

  if (typeof logicalDate === 'string') {
    result = logicalDateStringCodeDateFactory(logicalDate)(now);
  } else {
    result = logicalDate;
  }

  return result;
}

/**
 * Type guard that checks whether the input is a recognized {@link LogicalDateStringCode}.
 *
 * @param logicalDate - value to check
 * @returns true if the value is one of the known logical date string codes
 *
 * @example
 * ```ts
 * isLogicalDateStringCode('today_start'); // true
 * isLogicalDateStringCode('not_a_code');  // false
 * isLogicalDateStringCode(new Date());    // false
 * ```
 */
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
