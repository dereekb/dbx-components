import { Writable } from 'ts-essentials';
import { MapFunction } from '../value/map';
import { Maybe } from '../value/maybe.type';
import { NumberString } from './number';

// MARK: Rounding
export type NumberRounding = 'none' | 'floor' | 'ceil' | 'round';
export type RoundingFunction = MapFunction<number, number>;

export function roundingFunction(type: NumberRounding): RoundingFunction {
  let fn: RoundingFunction;

  switch (type) {
    case 'floor':
      fn = Math.floor;
      break;
    case 'ceil':
      fn = Math.ceil;
      break;
    case 'none':
      fn = (x) => x;
      break;
    case 'round':
    default:
      fn = Math.round;
      break;
  }

  return fn;
}

export type RoundingInput = NumberRounding | RoundingFunction;

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
 * Rounds the input using cutToPrecision
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

// MARK: Steps
/**
 * Number used to increase or decrease by the "step" value. When used in rounding the steps are aligned at a StepOrigin.
 */
export type StepNumber = number;

/**
 * Origin value for StepNumbers that is used as an offset for input. Is usually 0.
 */
export type StepOrigin = number;

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

/**
 * roundNumberToStepFunction()
 */
export interface RoundNumberToStepFunctionConfig {
  step: StepNumber;
  /**
   * Type of rounding to use.
   */
  round: Omit<NumberRounding, 'none'>;
  /**
   * Offset to apply to each input number. Defaults to zero.
   */
  origin?: StepOrigin;
}

export type RoundNumberToStepFunctionInput = RoundNumberToStepFunctionConfig | StepNumber;

/**
 * Rounds the number to a specific "step" that contains it.
 *
 * For example, with the value of 2, and a step size of 5, and rounding using ceil, the value will be rounded up to 1.
 *
 * @param value Input value.
 * @returns Step that contains the value.
 */
export type RoundNumberToStepFunction = ((input: Maybe<number>) => number) & {
  readonly _round: RoundNumberToStepFunctionConfig;
};

export function roundNumberToStepFunction(input: RoundNumberToStepFunctionInput): RoundNumberToStepFunction {
  const config: RoundNumberToStepFunctionConfig = typeof input === 'number' ? { step: input, round: 'ceil' } : input;
  const { step, round } = config;
  const roundingFn = roundingFunction(round as NumberRounding);

  if (!step) {
    throw new Error('Step must be defined and non-zero.');
  }

  const fn: Writable<RoundNumberToStepFunction> = ((input: Maybe<number>) => {
    let value: number;

    switch (typeof input) {
      case 'number':
        value = input;
        break;
      default:
        value = 0;
        break;
    }

    return roundingFn(value / step) * step;
  }) as RoundNumberToStepFunction;
  fn._round = config;
  return fn as RoundNumberToStepFunction;
}
