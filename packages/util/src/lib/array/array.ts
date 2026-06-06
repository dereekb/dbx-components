import { type IterableOrValue, iterableToSet } from '../iterable/iterable';
import { type Maybe } from '../value/maybe.type';

// MARK: Types
/**
 * An array type that cannot contain any elements.
 */
export type EmptyArray = never[];

/**
 * A value that is either a single item of type T or an array of T items.
 */
export type ArrayOrValue<T> = T | T[];

// MARK: Functions
/**
 * Converts the input value to an array containing itself, or returns itself if it is a non-empty array. Returns undefined if the input is nullish or results in an empty array.
 *
 * @param arrayOrValue - Single value or array to convert.
 * @returns An array with at least one element, or undefined if the result would be empty.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, non-empty, convert, ensure, normalize
 * @dbxUtilRelated convert-maybe-to-array, convert-to-array
 */
export function convertMaybeToNonEmptyArray<T>(arrayOrValue: Maybe<ArrayOrValue<T>>): Maybe<T[]> {
  let result: Maybe<T[]>;

  if (arrayOrValue) {
    result = convertToArray(arrayOrValue);

    if (result.length === 0) {
      result = undefined;
    }
  }

  return result;
}

/**
 * Converts the input value to an array containing itself, or returns itself if it is an array. Returns an empty array if the input is nullish.
 *
 * @param arrayOrValue - Single value, array, or nullish value to convert.
 * @returns The input wrapped in an array, the input array itself, or an empty array if nullish.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, convert, ensure, normalize, maybe, nullish
 * @dbxUtilRelated convert-maybe-to-non-empty-array, convert-to-array, as-array
 */
export function convertMaybeToArray<T>(arrayOrValue: Maybe<ArrayOrValue<T>>): T[] {
  return arrayOrValue == null ? [] : convertToArray(arrayOrValue);
}

/**
 * Alias for {@link convertMaybeToArray}. Converts a maybe value or array into an array, returning an empty array for nullish input.
 */
export const asArray = convertMaybeToArray;
/**
 * Alias for {@link convertMaybeToNonEmptyArray}. Converts a maybe value or array into a non-empty array, returning undefined for nullish or empty input.
 */
export const asNonEmptyArray = convertMaybeToNonEmptyArray;

/**
 * Converts the input value to an array containing itself, or returns itself if it is already an array.
 *
 * @param arrayOrValue - Single value or array to convert.
 * @returns The input array unchanged, or a new single-element array wrapping the input value.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, convert, ensure, wrap, normalize
 * @dbxUtilRelated convert-maybe-to-array, convert-maybe-to-non-empty-array
 */
export function convertToArray<T>(arrayOrValue: ArrayOrValue<T>): T[] {
  return Array.isArray(arrayOrValue) ? arrayOrValue : [arrayOrValue];
}
/**
 * Returns the first value from the array, or the value itself if not an array.
 *
 * @param input - Single value or array to retrieve from.
 * @returns The first element of the array, or the input value itself.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, first, head, get, value
 * @dbxUtilRelated last-value, value-at-index, first-and-last-value
 */
export function firstValue<T>(input: ArrayOrValue<T>): T {
  return valueAtIndex(input, 0);
}

/**
 * Returns the last value from the array, or the value itself if not an array.
 *
 * @param input - Single value or array to retrieve from.
 * @returns The last element of the array, or the input value itself.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, last, tail, get, value
 * @dbxUtilRelated first-value, value-at-index, first-and-last-value
 */
export function lastValue<T>(input: ArrayOrValue<T>): T {
  return Array.isArray(input) ? (input.at(-1) as T) : input;
}

/**
 * Returns a tuple with the first and last value of the input.
 *
 * If the input is not an array, returns that value as both the first and last value.
 *
 * @param input - Single value or array to retrieve from.
 * @returns A two-element tuple of the first and last values.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, first, last, head, tail, tuple, endpoints
 * @dbxUtilRelated first-value, last-value, value-at-index
 */
export function firstAndLastValue<T>(input: ArrayOrValue<T>): [T, T] {
  const first = firstValue(input);
  const last = lastValue(input);
  return [first, last];
}

/**
 * Returns the value at the given index from an array, or the value itself if not an array.
 *
 * @param input - Single value or array to retrieve from.
 * @param index - Zero-based index of the element to retrieve.
 * @returns The element at the specified index, or the input value itself if not an array.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, index, get, value, at
 * @dbxUtilRelated first-value, last-value, first-and-last-value
 */
export function valueAtIndex<T>(input: ArrayOrValue<T>, index: number): T {
  return Array.isArray(input) ? input[index] : input;
}

/**
 * Concatenates the input arrays into a single array, filtering out nullish entries.
 *
 * @param arrays - Arrays to concatenate; nullish entries are ignored.
 * @returns A single flattened array containing all elements from the non-nullish input arrays.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, concat, concatenate, combine, flatten, merge
 * @dbxUtilRelated flatten-array, merge-arrays
 */
export function concatArrays<T>(...arrays: Maybe<T[]>[]): T[] {
  return flattenArray(arrays.filter(Boolean) as T[][]);
}

/**
 * Flattens a two-dimensional array into a single-dimensional array. Any null/undefined entries in the outer dimension are filtered out.
 *
 * @param array - Two-dimensional array to flatten, may contain nullish entries.
 * @returns A single-dimensional array with all elements from the non-nullish inner arrays.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, flatten, flat, nested, two-dimensional, concat
 * @dbxUtilRelated concat-arrays, flatten-array-or-value-array, merge-arrays
 */
export function flattenArray<T>(array: Maybe<T[]>[]): T[] {
  const filteredValues: T[][] = array.filter(Boolean) as T[][];

  return filteredValues.flat();
}

/**
 * Flattens an array of {@link ArrayOrValue} entries into a single array. Nullish entries are filtered out.
 *
 * @param array - Array of single values or arrays to flatten.
 * @returns A single flat array containing all non-nullish elements.
 */
export function flattenArrayOrValueArray<T>(array: ArrayOrValue<Maybe<T>>[]): T[] {
  return flattenArray(array.map((x) => (x ? convertToArray(x) : undefined)) as Maybe<T[]>[]);
}

/**
 * Creates a shallow copy of the input array. Returns an empty array if the input is nullish.
 *
 * @param input - Array to copy, or nullish.
 * @returns A new array with the same elements, or an empty array if input is nullish.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, copy, clone, shallow, duplicate
 * @dbxUtilRelated convert-maybe-to-array
 */
export function copyArray<T>(input: Maybe<T[]>): T[] {
  return input == null ? ([] as T[]) : [...input];
}

/**
 * Pushes the same element onto the target array a specified number of times.
 *
 * @param target - Array to push elements into.
 * @param element - Element to push.
 * @param times - Number of times to push the element.
 * @returns The mutated target array.
 */
export function pushElementOntoArray<T>(target: T[], element: T, times: number): T[] {
  for (let i = 0; i < times; i += 1) {
    target.push(element);
  }

  return target;
}

/**
 * Merges all input arrays into a single new array. Nullish entries are ignored.
 *
 * @param arrays - Arrays to merge; nullish entries are skipped.
 * @returns A new array containing all elements from the provided arrays.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, merge, concat, flatten, combine
 * @dbxUtilRelated merge-arrays-into-array
 */
export function mergeArrays<T>(arrays: Maybe<T[]>[]): T[] {
  return mergeArraysIntoArray([], ...arrays);
}

/**
 * Merges the input arrays into the target array by pushing each item from each array. Creates an empty array if the target is nullish.
 *
 * @param target - Array to merge into; a new array is created if nullish.
 * @param arrays - Arrays whose elements are pushed into the target; nullish entries are skipped.
 * @returns The mutated target array, or a new array if the target was nullish.
 */
export function mergeArraysIntoArray<T>(target: Maybe<T[]>, ...arrays: Maybe<T[]>[]): T[] {
  target ??= [];

  arrays.forEach((array) => {
    if (array != null) {
      pushArrayItemsIntoArray(target, array);
    }
  });

  return target;
}

/**
 * Pushes the input value into the target array if it is not an array. If it is an array, pushes all of its elements into the target array.
 *
 * @param target - Array to push into.
 * @param value - Single value or array of values to add.
 * @returns The mutated target array.
 */
export function pushItemOrArrayItemsIntoArray<T>(target: T[], value: ArrayOrValue<T>): T[] {
  if (Array.isArray(value)) {
    pushArrayItemsIntoArray(target, value);
  } else {
    target.push(value);
  }

  return target;
}

/**
 * Merges all elements from the source array into the target array using push.
 *
 * This is preferable in cases where immutability is not required.
 *
 * @param target - Array to push elements into.
 * @param array - Source array whose elements are pushed into the target.
 * @returns The mutated target array.
 */
export function pushArrayItemsIntoArray<T>(target: T[], array: T[]): T[] {
  Array.prototype.push.apply(target, array);
  return target;
}

/**
 * Copies/takes the elements from the front of the array up to the specified maximum.
 *
 * @param values - Source array to take from.
 * @param maxToTake - Maximum number of elements to take from the front.
 * @returns A new array containing at most maxToTake elements from the front.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, take, front, head, slice, limit
 * @dbxUtilRelated take-last, split-front
 */
export function takeFront<T>(values: T[], maxToTake: number): T[] {
  return values.slice(0, maxToTake);
}

/**
 * splitFront() result
 */
export interface SplitFrontResult<T> {
  /**
   * The input max to take value.
   */
  readonly maxToTake: number;
  /**
   * The front of the array up to the maxToTake.
   */
  readonly front: T[];
  /**
   * The remaining values after the front.
   */
  readonly remaining: T[];
}

/**
 * Splits the array into two arrays, the first being the front of the array up to the maxToTake, and the second being the remaining values.
 *
 * @param values - Source items to partition into front + remaining halves.
 * @param maxToTake - Upper bound on how many entries to take from the start.
 * @returns Pair containing the leading slice plus everything left over.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, split, partition, front, slice
 * @dbxUtilRelated take-front, take-last
 */
export function splitFront<T>(values: T[], maxToTake: number): SplitFrontResult<T> {
  return {
    maxToTake,
    front: takeFront(values, maxToTake),
    remaining: values.slice(maxToTake)
  };
}

/**
 * Copies/takes as many elements as possible from the end.
 *
 * @param values - Values to take from.
 * @param maxToTake - Max number of values to take from the end of the input array.
 * @param keepFromFront - Number of values to retain in the front of the array. These are not taken.
 * @returns New array with the subset of taken values.
 * @throws {Error} When `maxToTake` is smaller than `keepFromFront`.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, take, last, tail, end, slice, limit
 * @dbxUtilRelated take-front, split-front
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
 * Performs a forEach iteration over the input and returns the resulting array. If the input is nullish, returns an empty array.
 *
 * @param array - Single value, array, or nullish value to iterate over.
 * @param forEach - Callback invoked for each element.
 * @returns Items iterated by the callback; empty when the input was nullish.
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

/**
 * Counts the total number of elements across all inner arrays of a nested array.
 *
 * @param array - Two-dimensional array whose elements are counted.
 * @returns The total number of elements across all inner arrays.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, count, nested, total, length, two-dimensional
 * @dbxUtilRelated flatten-array
 */
export function countAllInNestedArray<T>(array: T[][]): number {
  return array.reduce((acc, curr) => acc + curr.length, 0);
}

/**
 * Creates a copy of the array with the items at the specified indexes removed.
 *
 * @param array - Source array to copy from.
 * @param removeIndexes - Indexes of elements to exclude from the copy.
 * @returns A new array without the elements at the specified indexes.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, remove, exclude, indexes, filter, copy
 */
export function removeValuesAtIndexesFromArrayCopy<T>(array: T[], removeIndexes: IterableOrValue<number>): T[] {
  const result: T[] = [];
  const ignoredIndexes = iterableToSet(removeIndexes);

  array.forEach((value, index) => {
    if (!ignoredIndexes.has(index)) {
      result.push(value);
    }
  });

  return result;
}
