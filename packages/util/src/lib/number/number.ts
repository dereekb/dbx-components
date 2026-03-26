import { minAndMaxFunction, type MinAndMaxFunctionResult, type SortCompareFunction } from '../sort';
import { type MapFunction } from '../value/map';
import { type Maybe } from '../value/maybe.type';

/**
 * A non-negative integer representing a count of items.
 *
 * @example
 * ```ts
 * const totalUsers: Count = 42;
 * ```
 */
export type Count = number;

/**
 * A string represented within a number.
 */
export type NumberString = string;

/**
 * Number that represents a percent.
 *
 *  e.g. PercentNumber of 5 = 0.05 = 5%
 */
export type PercentNumber = number;

/**
 * A percent decimal value.
 *
 * e.g. PercentDecimal of 0.05 = 5%
 */
export type PercentDecimal = number;

/**
 * Converts a {@link PercentNumber} (e.g., 5 for 5%) to its decimal equivalent (e.g., 0.05).
 *
 * Returns 0 for null/undefined input.
 *
 * @param input - A percent number value (e.g., 5 means 5%)
 * @returns The decimal equivalent
 */
export function percentNumberToDecimal(input: Maybe<number>): number {
  return input ? input / 100 : 0;
}

/**
 * Converts a {@link PercentDecimal} (e.g., 0.05 for 5%) to its {@link PercentNumber} equivalent (e.g., 5).
 *
 * Returns 0 for null/undefined input.
 *
 * @param input - A decimal percent value (e.g., 0.05 means 5%)
 * @returns The percent number equivalent
 */
export function percentNumberFromDecimal(input: Maybe<number>): PercentNumber {
  return input ? input * 100 : 0;
}

export type NumberOrNumberString = number | NumberString;

/**
 * Reads a number from the input value.
 */
export type ReadNumberFunction<T, N extends number = number> = MapFunction<T, N>;

/**
 * asNumber() input
 */
export type AsNumberInput = Maybe<NumberOrNumberString>;

/**
 * Converts a number, string, or null/undefined value to a number.
 *
 * Strings are parsed via `Number()`. Null/undefined returns 0.
 *
 * @param input - A number, number string, or null/undefined
 * @returns The numeric value, or 0 for null/undefined
 */
export function asNumber(input: AsNumberInput): number {
  let value: number;

  switch (typeof input) {
    case 'number':
      value = input;
      break;
    case 'string':
      value = Number(input);
      break;
    default:
      value = 0;
      break;
  }

  return value;
}

/**
 * Checks whether the input value is evenly divisible by the divisor.
 *
 * Treats null/undefined as 0.
 *
 * @param value - The number to check
 * @param divisor - The divisor to test against
 * @returns `true` if the remainder is zero
 */
export function isNumberDivisibleBy(value: Maybe<number>, divisor: number): boolean {
  const remainder = (value ?? 0) % divisor;
  return remainder === 0;
}

export interface NearestDivisibleValues {
  value: number;
  divisor: number;
  nearestCeil: number;
  nearestFloor: number;
}

/**
 * Finds the nearest values that are evenly divisible by the divisor, both above (ceil) and below (floor) the input value.
 *
 * @param value - The value to find divisible neighbors for
 * @param divisor - The divisor to align to
 * @returns Object with the input value, divisor, and the nearest ceil/floor divisible values
 */
export function nearestDivisibleValues(value: number, divisor: number): NearestDivisibleValues {
  const point = value / divisor;
  const ceilPoint = Math.ceil(point);
  const floorPoint = Math.floor(point);

  return {
    value,
    divisor,
    nearestCeil: ceilPoint * divisor,
    nearestFloor: floorPoint * divisor
  };
}

/**
 * Checks whether the input is an even number.
 *
 * @param value - Number to test
 * @returns `true` if even
 */
export function isEvenNumber(value: number): boolean {
  return value % 2 === 0;
}

/**
 * Checks whether the input is an odd number.
 *
 * @param value - Number to test
 * @returns `true` if odd
 */
export function isOddNumber(value: number): boolean {
  return value % 2 === 1;
}

/**
 * Computes the sum of all integers between two values, inclusive, using Gauss's formula.
 *
 * The `from` value is floored and the `to` value is ceiled before computation.
 *
 * @param from - The starting value (floored to nearest integer)
 * @param to - The ending value (ceiled to nearest integer)
 * @returns Sum of all integers in the range
 */
export function sumOfIntegersBetween(from: number, to: number): number {
  const x = Math.floor(from);
  const y = Math.ceil(to);

  const totalNumbers = y - x + 1;
  const sum = x + y;

  return (sum / 2) * totalNumbers;
}

/**
 * A {@link SortCompareFunction} for numbers that sorts in ascending order.
 *
 * @param a - the first number to compare
 * @param b - the second number to compare
 * @returns a negative value if `a` is less than `b`, zero if equal, or a positive value if `a` is greater
 */
export const sortCompareNumberFunction: SortCompareFunction<number> = (a, b) => a - b;

/**
 * Finds the minimum and maximum values from an iterable of numbers.
 *
 * @param values - Iterable of numbers to examine
 * @returns Object with `min` and `max` values
 */
export function minAndMaxNumber(values: Iterable<number>): MinAndMaxFunctionResult<number> {
  return minAndMaxFunction(sortCompareNumberFunction)(values);
}

/**
 * Computes the logarithm of `y` with base `x`.
 *
 * @param x - The base of the logarithm
 * @param y - The value to compute the logarithm of
 * @returns The base-x logarithm of y
 *
 * @example
 * ```ts
 * getBaseLog(2, 16); // 4 (2^4 = 16)
 * getBaseLog(10, 100); // 2 (10^2 = 100)
 * ```
 */
export function getBaseLog(x: number, y: number): number {
  return Math.log(y) / Math.log(x);
}
