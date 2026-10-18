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
 * @param type - The rounding strategy: 'floor', 'ceil', 'round', or 'none'.
 * @returns The corresponding Math function, or an identity function for 'none'.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind factory
 * @dbxUtilTags number, round, floor, ceil, math, factory, rounding
 * @dbxUtilRelated cut-value-to-precision-function, round-to-precision-function
 *
 * @__NO_SIDE_EFFECTS__
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
 * @param input - Number, number string, or null/undefined.
 * @param precision - Number of decimal places to retain.
 * @returns The truncated number value.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilTags number, precision, decimal, truncate, cut, round
 * @dbxUtilRelated cut-value-to-precision-function, cut-value-to-integer, round-to-precision
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
 * @param input - Number, number string, or null/undefined.
 * @returns The truncated integer value.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilTags number, integer, truncate, floor, cut, parse
 * @dbxUtilRelated cut-value-to-precision, as-number
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
 * @param precision - Number of decimal places to retain.
 * @param roundingType - Rounding strategy; defaults to 'cut' (truncation)
 * @returns Accepts a number or string and returns the truncated number.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind factory
 * @dbxUtilTags number, precision, cut, truncate, factory, round
 * @dbxUtilRelated round-to-precision-function, cut-to-precision
 *
 * @__NO_SIDE_EFFECTS__
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
 * @param precision - Number of decimal places.
 * @param roundFn - Rounding strategy; defaults to 'round'. Use 'cut' for truncation.
 * @returns Rounds numbers to the configured precision.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind factory
 * @dbxUtilTags number, round, precision, factory, decimals
 * @dbxUtilRelated cut-value-to-precision-function, round-to-precision, cut-to-precision
 *
 * @__NO_SIDE_EFFECTS__
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
 * @param value - Number to round.
 * @param precision - Number of decimal places to retain.
 * @returns The rounded number.
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
 * @param value - Number to truncate.
 * @param precision - Number of decimal places to retain.
 * @returns The truncated number.
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
 * @param value - Input value.
 * @param step - Step size to round up to.
 * @returns The nearest multiple of step that is >= value.
 */
export function roundNumberUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/**
 * roundNumberToStepFunction()
 */
export interface RoundNumberToStepFunctionConfig {
  readonly step: StepNumber;
  /**
   * Type of rounding to use.
   */
  readonly round: Omit<NumberRounding, 'none'>;
  /**
   * Offset to apply to each input number. Defaults to zero.
   */
  readonly origin?: StepOrigin;
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
 * @param input - Step size or full configuration.
 * @returns Rounds input numbers to the nearest step.
 * @throws {Error} If step is 0 or undefined.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind factory
 * @dbxUtilTags number, round, step, factory, multiple, origin
 * @dbxUtilRelated round-number-up-to-step, round-to-precision-function
 *
 * @__NO_SIDE_EFFECTS__
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

// MARK: Factor
/**
 * Number used to convert values between two scales. Values are divided by the factor when reduced, and multiplied by the factor when expanded.
 *
 * For example, with a factor of 15, the value 45 reduces to 3, and 3 expands back to 45.
 *
 * @semanticType
 * @semanticTopic numeric
 */
export type NumberFactor = number;

/**
 * numberFactorConverter() configuration.
 */
export interface NumberFactorConverterConfig {
  /**
   * Factor to reduce and expand values by. Must be non-zero.
   */
  readonly factor: NumberFactor;
  /**
   * Rounding applied to reduced values.
   *
   * Defaults to 'floor'.
   */
  readonly round?: NumberRounding;
}

export type NumberFactorConverterInput = NumberFactorConverterConfig | NumberFactor;

/**
 * Converts numbers down and up by a NumberFactor.
 */
export interface NumberFactorConverter {
  readonly factor: NumberFactor;
  readonly rounding: NumberRounding;
  /**
   * Divides the input by the factor, then applies the configured rounding.
   */
  readonly reduce: MapFunction<number, number>;
  /**
   * Multiplies the input by the factor.
   */
  readonly expand: MapFunction<number, number>;
  /**
   * Rounds the input to a multiple of the factor using the configured rounding. Equivalent to expand(reduce(value)).
   */
  readonly round: MapFunction<number, number>;
}

/**
 * Creates a NumberFactorConverter that reduces values by dividing by the factor, expands values by multiplying by the factor, and rounds values to a multiple of the factor.
 *
 * Accepts either a factor (uses 'floor' rounding) or a full config with the factor and rounding type.
 *
 * @param input - Factor or full configuration.
 * @returns Converter that reduces, expands, and rounds numbers by the factor.
 * @throws {Error} If the factor is 0 or undefined.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind factory
 * @dbxUtilTags number, factor, convert, reduce, expand, round, scale, factory
 * @dbxUtilRelated round-number-to-step-function, minutes-increment-converter, minute-of-day-increment-converter
 *
 * @example
 * ```ts
 * const converter = numberFactorConverter(15);
 * converter.reduce(50); // 3
 * converter.expand(3); // 45
 * converter.round(50); // 45
 *
 * numberFactorConverter({ factor: 15, round: 'ceil' }).round(50); // 60
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function numberFactorConverter(input: NumberFactorConverterInput): NumberFactorConverter {
  const config: NumberFactorConverterConfig = typeof input === 'number' ? { factor: input } : input;
  const { factor, round: rounding = 'floor' } = config;

  if (!factor) {
    throw new Error('Factor must be defined and non-zero.');
  }

  const roundingFn = roundingFunction(rounding);
  const reduce = (value: number) => roundingFn(value / factor);
  const expand = (value: number) => value * factor;

  return {
    factor,
    rounding,
    reduce,
    expand,
    round: (value: number) => expand(reduce(value))
  };
}
