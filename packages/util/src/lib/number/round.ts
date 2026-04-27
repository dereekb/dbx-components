import { type Writable } from 'ts-essentials';
import { type MapFunction } from '../value/map';
import { type Maybe } from '../value/maybe.type';
import { asNumber, type AsNumberInput } from './number';

// MARK: Rounding
export type FloorOrCeilRounding = 'floor' | 'ceil';
export type NumberRounding = 'none' | FloorOrCeilRounding | 'round';
export type RoundingFunction = MapFunction<number, number>;

/**
 * Returns a rounding function for the specified rounding type.
 *
 * @param type - The rounding strategy: 'floor', 'ceil', 'round', or 'none'
 * @returns The corresponding Math function, or an identity function for 'none'
 */
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
 *
 * @semanticType
 * @semanticTopic numeric
 * @semanticTopic measurement
 */
export type NumberPrecision = number;

/**
 * Truncates a number (or number string) to the specified decimal precision without rounding.
 *
 * Accepts strings and null/undefined via {@link asNumber}.
 *
 * @param input - Number, number string, or null/undefined
 * @param precision - Number of decimal places to retain
 * @returns The truncated number value
 */
export function cutValueToPrecision(input: AsNumberInput, precision: NumberPrecision): number {
  return cutValueToPrecisionFunction(precision)(input);
}

/**
 * Cuts the value to zero precision.
 */
export const CUT_VALUE_TO_ZERO_PRECISION = cutValueToPrecisionFunction(0);

/**
 * Truncates a value to an integer by cutting to zero decimal precision.
 *
 * @param input - Number, number string, or null/undefined
 * @returns The truncated integer value
 */
export function cutValueToInteger(input: AsNumberInput): number {
  return CUT_VALUE_TO_ZERO_PRECISION(input);
}

/**
 * Rounds the input using cutToPrecision
 */
export type CutValueToPrecisionFunction = ((input: AsNumberInput) => number) & {
  readonly _precision: number;
};

/**
 * Creates a {@link CutValueToPrecisionFunction} that truncates values to the configured precision.
 *
 * @param precision - Number of decimal places to retain
 * @param roundingType - Rounding strategy; defaults to 'cut' (truncation)
 * @returns A function that accepts a number or string and returns the truncated number
 */
export function cutValueToPrecisionFunction(precision: NumberPrecision, roundingType: RoundToPrecisionFunctionType = 'cut'): CutValueToPrecisionFunction {
  const roundFn = roundToPrecisionFunction(precision, roundingType);
  const fn: Writable<CutValueToPrecisionFunction> = ((input: AsNumberInput) => {
    return roundFn(asNumber(input));
  }) as CutValueToPrecisionFunction;
  fn._precision = precision;
  return fn as CutValueToPrecisionFunction;
}

// MARK: Number/Math
/**
 * Rounds the input number to the given precision using a configured rounding function.
 *
 * @param value
 * @param precision
 * @returns
 */
export type RoundToPrecisionFunction = MapFunction<number, number>;

export type RoundToPrecisionFunctionType = NumberRounding | 'cut';

/**
 * Creates a function that rounds numbers to the specified precision using a configurable rounding strategy.
 *
 * @param precision - Number of decimal places
 * @param roundFn - Rounding strategy; defaults to 'round'. Use 'cut' for truncation.
 * @returns A function that rounds numbers to the configured precision
 */
export function roundToPrecisionFunction(precision: NumberPrecision, roundFn: RoundToPrecisionFunctionType = 'round'): RoundToPrecisionFunction {
  let result: RoundToPrecisionFunction;

  if (roundFn === 'cut') {
    result = (value) => cutToPrecision(value, precision);
  } else {
    const rndFn = roundingFunction(roundFn);
    result = (value) => +(rndFn(Number(value + 'e+' + precision)) + 'e-' + precision);
  }

  return result;
}

/**
 * Rounds a number to the specified decimal precision using `Math.round`.
 *
 * @param value - Number to round
 * @param precision - Number of decimal places to retain
 * @returns The rounded number
 */
export function roundToPrecision(value: number, precision: NumberPrecision): number {
  return +(Math.round(Number(value + 'e+' + precision)) + 'e-' + precision);
}

/**
 * Truncates a number to the specified decimal precision without rounding.
 *
 * Uses `Math.floor` for positive numbers and `Math.ceil` for negative numbers to truncate toward zero.
 * For example, 1.25 with precision 1 becomes 1.2 (not 1.3).
 *
 * @param value - Number to truncate
 * @param precision - Number of decimal places to retain
 * @returns The truncated number
 */
export function cutToPrecision(value: number, precision: NumberPrecision): number {
  // use floor for positive numbers, ceil for negative numbers
  const rndFn = value > 0 ? Math.floor : Math.ceil;
  return +(rndFn(Number(value + 'e+' + precision)) + 'e-' + precision);
}

// MARK: Steps
/**
 * Number used to increase or decrease by the "step" value. When used in rounding the steps are aligned at a StepOrigin.
 *
 * @semanticType
 * @semanticTopic numeric
 */
export type StepNumber = number;

/**
 * Origin value for StepNumbers that is used as an offset for input. Is usually 0.
 *
 * @semanticType
 * @semanticTopic numeric
 */
export type StepOrigin = number;

/**
 * Rounds a number up to the nearest multiple of the step size using `Math.ceil`.
 *
 * @param value - Input value
 * @param step - Step size to round up to
 * @returns The nearest multiple of step that is >= value
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

/**
 * Creates a function that rounds numbers to the nearest step multiple using a configurable rounding strategy.
 *
 * Accepts either a step number (uses 'ceil' rounding) or a full config with step, rounding type, and origin.
 *
 * @param input - Step size or full configuration
 * @returns A function that rounds input numbers to the nearest step
 * @throws Error if step is 0 or undefined
 */
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
