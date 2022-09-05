import { Maybe } from '../value/maybe.type';

/**
 * A string represented within a number.
 */
export type NumberString = string;

export type NumberOrNumberString = number | NumberString;

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
