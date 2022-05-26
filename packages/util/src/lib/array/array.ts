import { Maybe } from '../value/maybe';

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

export const asArray = convertMaybeToArray;

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
export function concatArrays<T>(...arrays: Maybe<T[]>[]): T[] {
  return flattenArray(arrays.filter((x) => Boolean(x)) as T[][]);
}

/**
 * Flattens a two dimensional array into a single dimensional array. Any null/undefined values from the first dimension are filtered out.
 *
 * @param array
 * @returns
 */
export function flattenArray<T>(array: Maybe<T[]>[]): T[] {
  return (array.filter((x) => Boolean(x)) as T[][]).reduce((accumulator: T[], value: T[]) => accumulator.concat(value), []);
}

/**
 * Flattens an array of ArrayOrValue values into a single array.
 *
 * @param array
 * @returns
 */
export function flattenArrayOrValueArray<T>(array: ArrayOrValue<Maybe<T>>[]): T[] {
  return flattenArray(array.map((x) => (x ? convertToArray(x) : undefined)) as Maybe<T[]>[]);
}

export function copyArray<T>(input: Maybe<T[]>): T[] {
  return input != null ? Array.from(input) : ([] as T[]);
}

export function pushElementOntoArray<T>(target: T[], element: T, times: number): T[] {
  for (let i = 0; i < times; i += 1) {
    target.push(element);
  }

  return target;
}

/**
 * Merges all input arrays into a single array.
 *
 * @param arrays
 * @returns
 */
export function mergeArrays<T>(arrays: Maybe<T[]>[]): T[] {
  return mergeIntoArray([], ...arrays);
}

/**
 * Merges the input arrays into the target.
 *
 * @param target
 * @param arrays
 * @returns
 */
export function mergeIntoArray<T>(target: Maybe<T[]>, ...arrays: Maybe<T[]>[]): T[] {
  if (target == null) {
    target = [];
  }

  arrays.forEach((array) => {
    if (array != null) {
      mergeArrayIntoArray(target as T[], array);
    }
  });

  return target;
}

export function mergeArrayOrValueIntoArray<T>(target: T[], value: ArrayOrValue<T>): T[] {
  if (Array.isArray(value)) {
    return mergeArrayIntoArray(target, value);
  } else {
    target.push(value);
    return target;
  }
}

/**
 * Merges all the values from the second array into the first using push.
 *
 * This is preferable in cases where immutability is not required.
 *
 * @param target
 * @param array
 */
export function mergeArrayIntoArray<T>(target: T[], array: T[]): T[] {
  Array.prototype.push.apply(target, array);
  return target;
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

/**
 * Picks an item randomly from the input array. If the array is empty, returns undefined.
 *
 * @param values
 */
export function pickOneRandomly<T>(values: T[]): T {
  const random = Math.random();
  const index = Math.round(random * (values.length - 1));
  return values[index];
}

/**
 * Performs forEach with the input array and returns the array.
 *
 * @param array
 * @param forEach
 * @returns
 */
export function forEachWithArray<T>(array: Maybe<ArrayOrValue<T>>, forEach: (value: T) => void): T[] {
  if (array) {
    array = convertToArray(array);
    array.forEach(forEach);
  } else {
    array = [];
  }

  return array;
}
