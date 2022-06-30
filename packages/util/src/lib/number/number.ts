import { Maybe } from '../value/maybe.type';

/**
 * A string represented within a number.
 */
export type NumberString = string;

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
