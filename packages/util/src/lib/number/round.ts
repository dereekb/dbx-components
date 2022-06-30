import { Writable } from 'ts-essentials';
import { Maybe } from '../value/maybe.type';
import { NumberString } from './number';

// MARK: Precision

/**
 * The number of decimal places ot use.
 */
export type NumberPrecision = number;

/**
 * Same as cutToPrecision, but can take in a string or null/undefined.
 *
 * @param input
 * @param precision
 * @returns
 */
export function cutValueToPrecision(input: Maybe<number | NumberString>, precision: NumberPrecision): number {
  return cutValueToPrecisionFunction(precision)(input);
}

/**
 * Rounds the input
 */
export type CutValueToPrecisionFunction = ((input: Maybe<number | NumberString>) => number) & {
  readonly _precision: number;
};

/**
 * Creates a CutValueToPrecisionFunction
 *
 * @param precision
 * @returns
 */
export function cutValueToPrecisionFunction(precision: NumberPrecision): CutValueToPrecisionFunction {
  const fn: Writable<CutValueToPrecisionFunction> = ((input: Maybe<number | NumberString>) => {
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

    return cutToPrecision(value, precision);
  }) as CutValueToPrecisionFunction;
  fn._precision = precision;
  return fn as CutValueToPrecisionFunction;
}

// MARK: Number/Math
/**
 * Rounds the input number to the given precision.
 *
 * @param value
 * @param precision
 * @returns
 */
export function roundToPrecision(value: number, precision: NumberPrecision): number {
  return +(Math.round(Number(value + 'e+' + precision)) + 'e-' + precision);
}

/**
 * Cuts the input number to the given precision. For example, 1.25 with precision 1 will not be rounded up to 1.3, but instead be "cut" to 1.2
 *
 * @param value
 * @param precision
 * @returns
 */
export function cutToPrecision(value: number, precision: NumberPrecision): number {
  // use floor for positive numbers, ceil for negative numbers
  const rndFn = value > 0 ? Math.floor : Math.ceil;
  return +(rndFn(Number(value + 'e+' + precision)) + 'e-' + precision);
}

/**
 * Rounds the number up to a specific "step" that contains it.
 *
 * For example, with the value of 2, and a step size of 5, the value will be rounded up to 1.
 *
 * @param value Input value.
 * @param step Step size.
 * @returns Step that contains the value.
 */
export function roundNumberUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}
