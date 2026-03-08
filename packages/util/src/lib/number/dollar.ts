import { type Maybe } from '../value/maybe.type';
import { cutToPrecision } from './round';

/**
 * Whole dollar amounts, before the ','.
 */
export type WholeDollarAmount = number;

/**
 * Dollar amount number.
 */
export type DollarAmount = number;
export type CentsAmount = number;

export interface DollarsPair {
  dollars: WholeDollarAmount;
  cents: CentsAmount;
}

/**
 * Unit to affix to a dollar amount string.
 */
export type DollarAmountUnit = string;

/**
 * String representing a dollar amount.
 *
 * Is formatted as a number with two decimal places. No unit is affixed.
 */
export type DollarAmountString = string;

/**
 * String representing a dollar amount with a unit prefix.
 */
export type DollarAmountStringWithUnit<U extends DollarAmountUnit> = `${U}${DollarAmountString}`;

export const DOLLAR_AMOUNT_STRING_REGEX = /^\$?([0-9]+)\.?([0-9][0-9])$/;

/**
 * Dollar amounts are to two decimal places.
 */
export const DOLLAR_AMOUNT_PRECISION = 2;

/**
 * Checks whether the input string matches the expected dollar amount format (e.g., "12.50" or "$12.50").
 *
 * @param value - String to test
 * @returns `true` if the string matches the dollar amount regex
 */
export function isDollarAmountString(value: string): boolean {
  return DOLLAR_AMOUNT_STRING_REGEX.test(value);
}

/**
 * Formats a number as a dollar amount string with exactly two decimal places.
 *
 * Truncates (does not round) excess precision: e.g., 1.115 becomes "1.11". Returns "0.00" for null/undefined.
 *
 * @param number - The dollar amount to format
 * @returns Formatted string with two decimal places (e.g., "12.50")
 */
export function dollarAmountString(number: Maybe<number>): string {
  if (number) {
    return cutToPrecision(number, DOLLAR_AMOUNT_PRECISION).toFixed(DOLLAR_AMOUNT_PRECISION);
  } else {
    return '0.00';
  }
}

/**
 * Function that formats the input number as a dollar amount string with a unit.
 *
 * @param unit
 * @returns
 */
export type DollarAmountStringWithUnitFunction<U extends DollarAmountUnit> = ((amount: DollarAmount) => DollarAmountStringWithUnit<U>) & {
  readonly unit: U;
};

/**
 * Creates a function that formats dollar amounts as strings with a unit prefix (e.g., "$12.50").
 *
 * @param unit - The unit prefix to prepend; defaults to "$"
 * @returns A function that formats dollar amounts with the configured unit
 */
export function dollarAmountStringWithUnitFunction<U extends DollarAmountUnit>(unit: U = '$' as U): DollarAmountStringWithUnitFunction<U> {
  const fn = (amount: DollarAmount) => `${unit}${dollarAmountString(amount)}`;
  fn.unit = unit;
  return fn as DollarAmountStringWithUnitFunction<U>;
}
