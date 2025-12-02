import { type Maybe, type MaybeNot } from '../value/maybe.type';
import { isDate } from './date';

/**
 * Not to be confused with UnixDateTimeNumber, this value is in seconds instead of milliseconds.
 */
export type UnixDateTimeSecondsNumber = number;

/**
 * Not to be confused with DateOrUnixDateTimeNumber, this value is in seconds instead of milliseconds.
 */
export type DateOrUnixDateTimeSecondsNumber = Date | UnixDateTimeSecondsNumber;

/**
 * Converts a Date object or unix timestamp number to a unix timestamp number.
 *
 * @param input - Date object or unix timestamp number to convert
 * @returns Unix timestamp number if input is valid, null/undefined if input is null/undefined
 */
export function unixDateTimeSecondsNumberFromDateOrTimeNumber(input: Maybe<DateOrUnixDateTimeSecondsNumber>): Maybe<UnixDateTimeSecondsNumber> {
  if (input == null) {
    return input as null | undefined;
  } else if (isDate(input)) {
    return unixDateTimeSecondsNumberFromDate(input as Date);
  } else {
    return input as UnixDateTimeSecondsNumber;
  }
}

/**
 * Gets the current time as a unix timestamp number.
 *
 * @returns Current time as unix timestamp number
 */
export function unixDateTimeSecondsNumberForNow(): UnixDateTimeSecondsNumber {
  return unixDateTimeSecondsNumberFromDate(new Date());
}

/**
 * Converts a Date object to a unix timestamp number.
 *
 * @param date - Date object to convert
 * @returns Unix timestamp number if date is valid, null/undefined if date is null/undefined
 */
export function unixDateTimeSecondsNumberFromDate(date: Date): UnixDateTimeSecondsNumber;
export function unixDateTimeSecondsNumberFromDate(date: MaybeNot): MaybeNot;
export function unixDateTimeSecondsNumberFromDate(date: Maybe<Date>): Maybe<UnixDateTimeSecondsNumber> {
  return date != null ? Math.ceil(date.getTime() / 1000) : (date as null | undefined);
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
  if (input == null) {
    return input as null | undefined;
  } else if (isDate(input)) {
    return input as Date;
  } else {
    return unixDateTimeSecondsNumberToDate(input as UnixDateTimeSecondsNumber);
  }
}

/**
 * Converts a unix timestamp number to a Date object.
 *
 * @param dateTimeNumber - Unix timestamp number to convert
 * @returns Date object if timestamp is valid, null/undefined if timestamp is null/undefined
 */
export function unixDateTimeSecondsNumberToDate(dateTimeNumber: Maybe<UnixDateTimeSecondsNumber>): Maybe<Date> {
  return dateTimeNumber != null ? new Date(dateTimeNumber * 1000) : (dateTimeNumber as null | undefined);
}

// MARK: Compat
/**
 * @deprecated use UnixDateTimeSecondsNumber instead
 */
export type UnixTimeNumber = UnixDateTimeSecondsNumber;

/**
 * @deprecated use DateOrUnixDateTimeSecondsNumber instead
 */
export type DateOrUnixTimeNumber = Date | UnixTimeNumber;

/**
 * @deprecated use unixDateTimeSecondsNumberFromDateOrTimeNumber instead
 */
export const unixTimeNumberFromDateOrTimeNumber = unixDateTimeSecondsNumberFromDateOrTimeNumber;

/**
 * @deprecated use unixDateTimeSecondsNumberForNow instead
 */
export const unixTimeNumberForNow = unixDateTimeSecondsNumberForNow;

/**
 * @deprecated use unixDateTimeSecondsNumberFromDate instead
 */
export const unixTimeNumberFromDate = unixDateTimeSecondsNumberFromDate;

/**
 * @deprecated use dateFromDateOrTimeSecondsNumber instead
 */
export const dateFromDateOrTimeNumber = dateFromDateOrTimeSecondsNumber;

/**
 * @deprecated use unixDateTimeSecondsNumberToDate instead
 */
export const unixTimeNumberToDate = unixDateTimeSecondsNumberToDate;
