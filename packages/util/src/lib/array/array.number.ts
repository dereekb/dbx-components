import { type IndexRange } from '../value/indexed';

/**
 * Reduces an array of numbers to its maximum value.
 *
 * @param array - numbers to evaluate
 * @param emptyArrayValue - value to return when the array is empty
 * @returns the maximum number in the array, or the empty array value if the array is empty
 */
export function reduceNumbersWithMax(array: number[], emptyArrayValue?: number): number | undefined {
  return reduceNumbersWithMaxFn(emptyArrayValue)(array);
}

/**
 * Creates a reducer function that finds the maximum value in a number array.
 *
 * @param emptyArrayValue - value to return when the array is empty
 * @returns a function that reduces a number array to its maximum value
 */
export function reduceNumbersWithMaxFn(emptyArrayValue?: number): (array: number[]) => number | undefined {
  return reduceNumbersFn((a, b) => Math.max(a, b), emptyArrayValue);
}

/**
 * Reduces an array of numbers to its minimum value.
 *
 * @param array - numbers to evaluate
 * @param emptyArrayValue - value to return when the array is empty
 * @returns the minimum number in the array, or the empty array value if the array is empty
 */
export function reduceNumbersWithMin(array: number[], emptyArrayValue?: number): number | undefined {
  return reduceNumbersWithMinFn(emptyArrayValue)(array);
}

/**
 * Creates a reducer function that finds the minimum value in a number array.
 *
 * @param emptyArrayValue - value to return when the array is empty
 * @returns a function that reduces a number array to its minimum value
 */
export function reduceNumbersWithMinFn(emptyArrayValue?: number): (array: number[]) => number | undefined {
  return reduceNumbersFn((a, b) => Math.min(a, b), emptyArrayValue);
}

/**
 * Reduces an array of numbers by summing all values.
 *
 * @param array - numbers to sum
 * @param emptyArrayValue - value to return when the array is empty; defaults to 0
 * @returns the sum of all numbers in the array
 */
export function reduceNumbersWithAdd(array: number[], emptyArrayValue = 0): number {
  return reduceNumbersWithAddFn(emptyArrayValue)(array);
}

/**
 * Creates a reducer function that sums all values in a number array.
 *
 * @param emptyArrayValue - value to return when the array is empty; defaults to 0
 * @returns a function that reduces a number array to the sum of its values
 */
export function reduceNumbersWithAddFn(emptyArrayValue = 0): (array: number[]) => number {
  return reduceNumbersFn((a, b) => a + b, emptyArrayValue);
}

/**
 * Reduces an array of numbers using a custom reducer function.
 *
 * @param reduceFn - binary function applied to successive pairs of numbers
 * @param array - numbers to reduce
 * @param emptyArrayValue - value to return when the array is empty
 * @returns the reduced result, or the empty array value if the array is empty
 */
export function reduceNumbers(reduceFn: (a: number, b: number) => number, array: number[], emptyArrayValue?: number): number | undefined {
  if (array.length === 0) {
    return emptyArrayValue;
  } else {
    return reduceNumbersFn(reduceFn, emptyArrayValue)(array);
  }
}

/**
 * Creates a reusable reducer function that reduces a number array using a custom binary function.
 *
 * @param reduceFn - binary function applied to successive pairs of numbers
 * @param emptyArrayValue - value to return when the array is empty
 * @returns a function that reduces a number array to a single value
 */
export function reduceNumbersFn(reduceFn: (a: number, b: number) => number): (array: number[]) => number | undefined;
export function reduceNumbersFn<D extends number>(reduceFn: (a: number, b: number) => number, emptyArrayValue?: D): (array: number[]) => number | D;
export function reduceNumbersFn<D extends number>(reduceFn: (a: number, b: number) => number, emptyArrayValue?: D): (array: number[]) => number | D | undefined {
  const rFn = (array: number[]) => array.reduce(reduceFn);
  return (array: number[]) => (array.length ? rFn(array) : emptyArrayValue);
}

/**
 * Exclusive end value used by range().
 */
export type RangeInputEndValue = number;

/**
 * Input for range()
 */
export interface RangeInputObject {
  /**
   * Start value. Defaults to 0 if not defined.
   */
  readonly start?: number;
  /**
   * The exclusive end value.
   */
  readonly end: RangeInputEndValue;
}

/**
 * Input for the {@link range} function. Accepts a plain number (treated as the exclusive end with start at 0),
 * a {@link RangeInputObject}, or an {@link IndexRange}.
 */
export type RangeInput = number | RangeInputObject | IndexRange;

/**
 * Generates an array containing the range of numbers specified. The end value is excluded.
 * Supports ascending and descending ranges.
 *
 * @param input - range specification as a number, {@link RangeInputObject}, or {@link IndexRange}; when a number and `inputEnd` is provided, acts as the start value
 * @param inputEnd - optional exclusive end value when `input` is a number
 * @returns an array of sequential numbers within the specified range
 */
export function range(input: RangeInput, inputEnd?: RangeInputEndValue): number[] {
  const range = [];

  let start: number;
  let end: number;

  if (typeof input === 'number') {
    if (typeof inputEnd === 'number') {
      start = input;
      end = inputEnd;
    } else {
      start = 0;
      end = input;
    }
  } else {
    start = (input as RangeInputObject).start ?? (input as IndexRange).minIndex ?? 0;
    end = (input as RangeInputObject).end ?? (input as IndexRange).maxIndex;
  }

  if (end >= start) {
    for (let i = start; i < end; i += 1) {
      range.push(i);
    }
  } else {
    for (let i = start; i > end; i -= 1) {
      range.push(i);
    }
  }

  return range;
}
