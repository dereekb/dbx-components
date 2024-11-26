import { minAndMaxFunction, type MinAndMaxFunctionResult, type SortCompareFunction } from '../sort';
import { type MapFunction } from '../value/map';
import { type Maybe } from '../value/maybe.type';

/**
 * A string represented within a number.
 */
export type NumberString = string;

/**
 * Number that represents a percent.
 *
 *  e.g. 5 = 0.05 = 5%
 */
export type PercentNumber = number;

/**
 * Converts the percent number to a decimal value.
 *
 * @param input
 * @returns
 */
export function percentNumberToDecimal(input: Maybe<number>): number {
  return input ? input / 100 : 0;
}

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
 * Converts the input value to a number.
 *
 * @param input
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
 * Returns true if the input value is divisible by the divisor.
 *
 * @param value
 * @param divisor
 * @returns
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
 * Returns true if the input value is divisible by the divisor.
 *
 * @param value
 * @param divisor
 * @returns
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
 * Returns true if the input is an even number.
 *
 * @param value
 * @returns
 */
export function isEvenNumber(value: number): boolean {
  return value % 2 === 0;
}

/**
 * Returns true if the input is an odd number.
 *
 * @param value
 * @returns
 */
export function isOddNumber(value: number): boolean {
  return value % 2 === 1;
}

/**
 * The sum of all numbers between the two input number values, inclusive.
 *
 * @param from
 * @param to
 */
export function sumOfIntegersBetween(from: number, to: number): number {
  const x = Math.floor(from);
  const y = Math.ceil(to);

  const totalNumbers = y - x + 1;
  const sum = x + y;

  const sumOfIntegers = (sum / 2) * totalNumbers;
  return sumOfIntegers;
}

export const sortCompareNumberFunction: SortCompareFunction<number> = (a, b) => a - b;

/**
 * Returns the min and max values from the input numbers.
 *
 * @param values
 * @returns
 */
export function minAndMaxNumber(values: Iterable<number>): MinAndMaxFunctionResult<number> {
  return minAndMaxFunction(sortCompareNumberFunction)(values);
}

/**
 * Returns the lorgathirm of y with base x.
 *
 * Example:
 * - (log2(16)): x = 2, y = 16 -> 4    (2^4 = 16)
 * - (log10(100)): x = 10, y = 100 -> 2   (10^2 = 100)
 *
 * @param x
 * @param y
 * @returns
 */
export function getBaseLog(x: number, y: number): number {
  return Math.log(y) / Math.log(x);
}
