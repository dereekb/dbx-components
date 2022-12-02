import { Maybe } from '../value/maybe.type';
import { cutToPrecision } from './round';

/**
 * Whole dollar amounts, before the ','.
 */
export type WholeDollarAmount = number;
export type CentsAmount = number;

export interface DollarsPair {
  dollars: WholeDollarAmount;
  cents: CentsAmount;
}

/**
 * String representing a dollar amount.
 *
 * Is formatted as a number with two decimal places.
 */
export type DollarAmountString = string;

export const DOLLAR_AMOUNT_STRING_REGEX = /^\$?([0-9]+)\.?([0-9][0-9])$/;

/**
 * Returns true if the input is a valid DollarAmountString value.
 *
 * @param value
 * @returns
 */
export function isDollarAmountString(value: string): boolean {
  return DOLLAR_AMOUNT_STRING_REGEX.test(value);
}

/**
 * Returns a dollar amount, or '0.00' if null/undefined.
 *
 * If the input number has more than two decimal places, only the first two are used; no rounding occurs. (I.E. 1.115 becomes 1.11)
 *
 * @param number
 */
export function dollarAmountString(number: Maybe<number>): string {
  if (number) {
    return cutToPrecision(number, 2).toFixed(2);
  } else {
    return '0.00';
  }
}
