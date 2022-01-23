import { Maybe } from "../value";

// MARK: Types
export type ArrayOrValue<T> = T | T[];

// MARK: Functions
/**
 * Converts the input value to an array containing itself, or returns itself if it is an array.
 * 
 * @param arrayOrValue 
 * @returns 
 */
export function convertMaybeToArray<T>(arrayOrValue: Maybe<ArrayOrValue<T>>): T[] {
  if (arrayOrValue != null) {
    return convertToArray(arrayOrValue);
  } else {
    return [];
  }
}

/**
 * Converts the input value to an array containing itself, or returns itself if it is an array.
 * 
 * @param arrayOrValue 
 * @returns 
 */
export function convertToArray<T>(arrayOrValue: ArrayOrValue<T>): T[] {
  return Array.isArray(arrayOrValue) ? arrayOrValue : [arrayOrValue];
}

/**
 * Returns the first value from the array.
 */
export function firstValue<T>(input: ArrayOrValue<T>): T {
  return valueAtIndex(input, 0);
}

/**
 * Returns the last value from the array.
 */
export function lastValue<T>(input: ArrayOrValue<T>): T {
  if (Array.isArray(input)) {
    return input[input.length - 1];
  } else {
    return input;
  }
}

export function valueAtIndex<T>(input: ArrayOrValue<T>, index: number): T {
  if (Array.isArray(input)) {
    return input[index];
  } else {
    return input;
  }
}

/**
 * Concatinates the input arrays and filters out falsy values.
 */
export function concatArrays<T>(...arrays: (Maybe<T[]>)[]): T[] {
  return flattenArray(arrays.filter(x => Boolean(x)) as T[][]);
}

export function flattenArray<T>(array: T[][]): T[] {
  return array.filter((x) => Boolean(x)).reduce((accumulator, value) => accumulator.concat([...value]), []);
}

export function copyArray<T>(input: T[] | undefined): T[] {
  return (input) ? [...input] : [];
}

/**
 * Copies/takes the elements from the front of the array up to the max.
 * 
 * @param values 
 * @param maxToTake 
 * @returns 
 */
export function takeFront<T>(values: T[], maxToTake: number): T[] {
  return values.slice(0, maxToTake);
}

/**
 * Copies/takes as many elements as possible from the end.
 * 
 * @param values Values to take from.
 * @param maxToTake Max number of values to take from the end of the input array.
 * @param keepFromFront Number of values to retain in the front of the array. These are not taken.
 * @returns New array with the subset of taken values.
 */
export function takeLast<T>(values: T[], maxToTake: number, keepFromFront: number = 0): T[] {
  let results: T[];

  if (maxToTake < keepFromFront) {
    throw new Error('Cannot take more than keeping from front.');
  } else if (keepFromFront === maxToTake) {
    results = values.slice(0, keepFromFront);
  } else {
    const length = values.length;

    const secondHalfStartIndex = Math.max(keepFromFront, length - (maxToTake - keepFromFront));
    const secondHalfEndIndex = length;

    results = [...values.slice(0, keepFromFront), ...values.slice(secondHalfStartIndex, secondHalfEndIndex)];
  }

  return results;
}
