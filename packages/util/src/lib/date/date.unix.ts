import { type Maybe, type MaybeNot } from '../value/maybe.type';
import { isDate } from './date';

/**
 * Similar to UnixDateTimeNumber, but is in seconds instead of milliseconds.
 */
export type UnixTimeNumber = number;

/**
 * Similar to DateOrUnixDateTimeNumber, but is in seconds instead of milliseconds.
 */
export type DateOrUnixTimeNumber = Date | UnixTimeNumber;

/**
 * Converts a Date object or unix timestamp number to a unix timestamp number.
 *
 * @param input - Date object or unix timestamp number to convert
 * @returns Unix timestamp number if input is valid, null/undefined if input is null/undefined
 */
export function unixTimeNumberFromDateOrTimeNumber(input: Maybe<DateOrUnixTimeNumber>): Maybe<UnixTimeNumber> {
  if (input == null) {
    return input as null | undefined;
  } else if (isDate(input)) {
    return unixTimeNumberFromDate(input as Date);
  } else {
    return input as UnixTimeNumber;
  }
}

/**
 * Gets the current time as a unix timestamp number.
 *
 * @returns Current time as unix timestamp number
 */
export function unixTimeNumberForNow(): UnixTimeNumber {
  return unixTimeNumberFromDate(new Date());
}

/**
 * Converts a Date object to a unix timestamp number.
 *
 * @param date - Date object to convert
 * @returns Unix timestamp number if date is valid, null/undefined if date is null/undefined
 */
export function unixTimeNumberFromDate(date: Date): UnixTimeNumber;
export function unixTimeNumberFromDate(date: MaybeNot): MaybeNot;
export function unixTimeNumberFromDate(date: Maybe<Date>): Maybe<UnixTimeNumber> {
  return date != null ? Math.ceil(date.getTime() / 1000) : (date as null | undefined);
}

/**
 * Converts a Date object or unix timestamp number to a Date object.
 *
 * @param input - Date object or unix timestamp number to convert
 * @returns Date object if input is valid. Returns null/undefined if input is null/undefined
 */
export function dateFromDateOrTimeNumber(input: DateOrUnixTimeNumber): Date;
export function dateFromDateOrTimeNumber(input: MaybeNot): MaybeNot;
export function dateFromDateOrTimeNumber(input: Maybe<DateOrUnixTimeNumber>): Maybe<Date>;
export function dateFromDateOrTimeNumber(input: Maybe<DateOrUnixTimeNumber>): Maybe<Date> {
  if (input == null) {
    return input as null | undefined;
  } else if (isDate(input)) {
    return input as Date;
  } else {
    return unixTimeNumberToDate(input as UnixTimeNumber);
  }
}

/**
 * Converts a unix timestamp number to a Date object.
 *
 * @param dateTimeNumber - Unix timestamp number to convert
 * @returns Date object if timestamp is valid, null/undefined if timestamp is null/undefined
 */
export function unixTimeNumberToDate(dateTimeNumber: Maybe<UnixTimeNumber>): Maybe<Date> {
  return dateTimeNumber != null ? new Date(dateTimeNumber * 1000) : (dateTimeNumber as null | undefined);
}
