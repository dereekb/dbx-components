import { type Maybe, type MaybeNot } from '../value/maybe.type';
import { isDate } from './date';

/**
 * This value is in seconds since the Epoch.
 *
 * Use UnixDateTimeMillisecondsNumber instead if you need milliseconds.
 *
 * @semanticType
 * @semanticTopic time
 * @semanticTopic numeric
 */
export type UnixDateTimeSecondsNumber = number;

/**
 * This value is in seconds since the Epoch.
 *
 * Use DateOrUnixDateTimeMillisecondsNumber instead if you need milliseconds.
 */
export type DateOrUnixDateTimeSecondsNumber = Date | UnixDateTimeSecondsNumber;

/**
 * Converts a Date object or unix timestamp number to a unix timestamp number.
 *
 * @param input - Date object or unix timestamp number to convert.
 * @returns Unix timestamp number if input is valid, null/undefined if input is null/undefined.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, unix, seconds, timestamp, convert, normalize
 * @dbxUtilRelated unix-date-time-seconds-number-from-date, date-from-date-or-time-seconds-number
 */
export function unixDateTimeSecondsNumberFromDateOrTimeNumber(input: Maybe<DateOrUnixDateTimeSecondsNumber>): Maybe<UnixDateTimeSecondsNumber> {
  let result: Maybe<UnixDateTimeSecondsNumber>;

  if (input == null) {
    result = input;
  } else if (isDate(input)) {
    result = unixDateTimeSecondsNumberFromDate(input);
  } else {
    result = input;
  }

  return result;
}

/**
 * Gets the current time as a unix timestamp number.
 *
 * @returns Current time as unix timestamp number.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, unix, seconds, timestamp, now, current, time
 * @dbxUtilRelated unix-date-time-seconds-number-from-date
 */
export function unixDateTimeSecondsNumberForNow(): UnixDateTimeSecondsNumber {
  return unixDateTimeSecondsNumberFromDate(new Date());
}

/**
 * Converts a Date object to a unix timestamp number.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, unix, seconds, timestamp, convert, epoch
 * @dbxUtilRelated unix-date-time-seconds-number-to-date, unix-date-time-seconds-number-for-now
 *
 * @param date - Date object to convert
 * @returns Unix timestamp number if date is valid, null/undefined if date is null/undefined
 */
export function unixDateTimeSecondsNumberFromDate(date: Date): UnixDateTimeSecondsNumber;
export function unixDateTimeSecondsNumberFromDate(date: MaybeNot): MaybeNot;
export function unixDateTimeSecondsNumberFromDate(date: Maybe<Date>): Maybe<UnixDateTimeSecondsNumber> {
  return date != null ? Math.ceil(date.getTime() / 1000) : date;
}

/**
 * Converts a Date object or unix timestamp number to a Date object.
 *
 * @param input - Date object or unix timestamp number to convert
 * @returns Date object if input is valid. Returns null/undefined if input is null/undefined
 */
export function dateFromDateOrTimeSecondsNumber(input: DateOrUnixDateTimeSecondsNumber): Date;
export function dateFromDateOrTimeSecondsNumber(input: MaybeNot): MaybeNot;
export function dateFromDateOrTimeSecondsNumber(input: Maybe<DateOrUnixDateTimeSecondsNumber>): Maybe<Date>;
export function dateFromDateOrTimeSecondsNumber(input: Maybe<DateOrUnixDateTimeSecondsNumber>): Maybe<Date> {
  let result: Maybe<Date>;

  if (input == null) {
    result = input;
  } else if (isDate(input)) {
    result = input;
  } else {
    result = unixDateTimeSecondsNumberToDate(input);
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
 * @dbxUtilTags date, unix, seconds, timestamp, convert, parse
 * @dbxUtilRelated unix-date-time-seconds-number-from-date, date-from-date-or-time-seconds-number
 */
export function unixDateTimeSecondsNumberToDate(dateTimeNumber: Maybe<UnixDateTimeSecondsNumber>): Maybe<Date> {
  return dateTimeNumber != null ? new Date(dateTimeNumber * 1000) : dateTimeNumber;
}
