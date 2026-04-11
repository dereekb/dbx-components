import { type PrimativeKey, type ReadKeyFunction } from '../key';
import { type DecisionFunction } from '../value/decision';
import { type Maybe } from '../value/maybe.type';

// MARK: Types
/**
 * An Iterable or a value.
 *
 * Note that strings are a valid Iterable, allowing iteration over characters.
 */
export type IterableOrValue<T> = T | Iterable<T>;

// MARK: Functions
/**
 * Converts an IterableOrValue to an Iterable. Non-iterable values are wrapped in an array.
 *
 * @param values - The value or iterable to convert
 * @param treatStringAsIterable - Whether to treat strings as iterable (defaults to false)
 * @returns An Iterable containing the value(s)
 */
export function asIterable<T = unknown>(values: IterableOrValue<T>, treatStringAsIterable?: boolean): Iterable<T> {
  let iterable: Iterable<T>;

  if (isIterable(values, treatStringAsIterable)) {
    iterable = values;
  } else {
    iterable = [values];
  }

  return iterable;
}

/**
 * Converts an IterableOrValue to an array.
 *
 * By default treats strings as a non-iterable value, using the string as a single value.
 *
 * @param values - The value or iterable to convert
 * @param treatStringAsIterable - Whether to treat strings as iterable (defaults to false)
 * @returns An array containing the value(s)
 */
export function iterableToArray<T = unknown>(values: IterableOrValue<T>, treatStringAsIterable?: boolean): T[] {
  let iterable: Array<T>;

  if (treatStringAsIterable && typeof values === 'string') {
    iterable = [values];
  } else if (isIterable(values)) {
    iterable = [...values]; // copy the array
  } else {
    iterable = [values];
  }

  return iterable;
}

/**
 * Converts an IterableOrValue to a Set.
 *
 * By default treats strings as a non-iterable value, using the string as a single value.
 *
 * @param values - The value or iterable to convert
 * @param treatStringAsIterable - Whether to treat strings as iterable (defaults to false)
 * @returns A Set containing the value(s)
 */
export function iterableToSet<T = unknown>(values: IterableOrValue<T>, treatStringAsIterable = false): Set<T> {
  return new Set<T>(iterableToArray(values, treatStringAsIterable));
}

/**
 * Converts an IterableOrValue to a Map using a key extraction function.
 *
 * @param values - The value or iterable to convert
 * @param readKey - Function to extract the key from each value
 * @returns A Map with the extracted keys and their corresponding values
 */
export function iterableToMap<T, K extends PrimativeKey = PrimativeKey>(values: IterableOrValue<T>, readKey: ReadKeyFunction<T, K>): Map<Maybe<K>, T> {
  return new Map<Maybe<K>, T>(iterableToArray(values).map((value) => [readKey(value), value]));
}

/**
 * Type guard that returns true if the input is an Iterable.
 * By default, strings are not treated as iterable.
 *
 * @param values - The value to check
 * @param treatStringAsIterable - Whether to treat strings as iterable (defaults to false)
 * @returns True if the value is iterable
 */
export function isIterable<T = unknown>(values: unknown, treatStringAsIterable = false): values is Iterable<T> {
  if (typeof values === 'string') {
    return treatStringAsIterable;
  }

  if (values != null && typeof values === 'object' && Symbol.iterator in values) {
    return true;
  }

  return false;
}

/**
 * Returns true if the iterable has no values.
 *
 * @param values - The iterable to check
 * @returns True if the iterable is empty
 */
export function isEmptyIterable<T = unknown>(values: Iterable<T>): boolean {
  for (const _ of values) {
    return false;
  }

  return true;
}

/**
 * Returns the first value from the Iterable, or undefined if empty. Order is not guaranteed.
 *
 * @param values - The iterable to read from
 * @returns The first value, or undefined if empty
 */
export function firstValueFromIterable<T>(values: Iterable<T>): Maybe<T> {
  for (const value of values) {
    return value;
  }

  return undefined;
}

/**
 * Takes up to `count` items from the iterable. Order is not guaranteed.
 *
 * @param values - The iterable to take from
 * @param count - Maximum number of items to take
 * @returns An array of taken values
 */
export function takeValuesFromIterable<T>(values: Iterable<T>, count: number): T[] {
  const result: T[] = [];

  for (const value of values) {
    if (result.length < count) {
      result.push(value);
    } else {
      break;
    }
  }

  return result;
}

/**
 * Iterates over iterable values, calling the function for each one.
 *
 * @param values - The iterable to iterate over
 * @param fn - The function to call for each value
 */
export function forEachInIterable<T>(values: Iterable<T>, fn: (value: T) => void): void {
  for (const value of values) {
    fn(value);
  }
}

/**
 * Calls the function for each value if the input is iterable, or once with the value if it's a single value.
 * Does nothing if the input is null/undefined.
 *
 * @param values - The value or iterable to process
 * @param fn - The function to call for each value
 * @param treatStringAsIterable - Whether to treat strings as iterable (defaults to false)
 */
export function useIterableOrValue<T>(values: Maybe<IterableOrValue<T>>, fn: (value: T) => void, treatStringAsIterable = false): void {
  if (values != null) {
    if (isIterable(values, treatStringAsIterable)) {
      forEachInIterable(values, fn);
    } else {
      fn(values);
    }
  }
}

/**
 * Finds and returns the first value in the iterable that matches the decision function.
 *
 * @param values - The iterable to search
 * @param fn - Decision function that returns true for the desired value
 * @returns The first matching value, or undefined
 */
export function findInIterable<T>(values: Iterable<T>, fn: DecisionFunction<T>): Maybe<T> {
  for (const value of values) {
    if (fn(value)) {
      return value;
    }
  }

  return undefined;
}

/**
 * Returns true if any value in the iterable matches the decision function.
 *
 * @param values - The iterable to search
 * @param fn - Decision function to test each value
 * @returns True if at least one value matches
 */
export function existsInIterable<T>(values: Iterable<T>, fn: DecisionFunction<T>): boolean {
  for (const value of values) {
    if (fn(value)) {
      return true;
    }
  }

  return false;
}

/**
 * Filters values from the iterable, keeping those that pass the decision function.
 *
 * @param values - The iterable to filter
 * @param fn - Decision function that returns true for values to keep
 * @returns An array of matching values
 */
export function filterFromIterable<T>(values: Iterable<T>, fn: DecisionFunction<T>): T[] {
  const keep: T[] = [];

  for (const value of values) {
    if (fn(value)) {
      keep.push(value);
    }
  }

  return keep;
}

/**
 * Wraps a single tuple value into an array. Distinguishes between a single tuple and an array of tuples
 * by checking whether nested array elements have uniform length.
 *
 * Used to prevent functions from incorrectly treating a tuple as an array of values.
 *
 * @param input - The tuple or array of tuples to wrap
 * @returns An array containing the tuple(s)
 * @throws Error if input is not an array
 */
export function wrapTuples<T>(input: IterableOrValue<T>): T[] {
  if (!Array.isArray(input)) {
    throw new Error('Input is not an array/tuple...');
  }

  let result: T[];

  // check if the first item is an array. Tuples can contain arrays as the first value.
  if (input.length > 0) {
    const firstValueInPotentialTupleOrArray = input[0];

    let inputIsSingleTuple = false;

    if (Array.isArray(firstValueInPotentialTupleOrArray)) {
      // if the first nested value is an array then the top-level value may be an array and not a tuple. Check the length of all the other values in the array to see if they have the same length.
      const expectedLength = firstValueInPotentialTupleOrArray.length;

      // if it is an array of tuples, all values should be the same length and be arrays. If not an array, then we're looking at a tuple.
      const firstNonUniformTupleValueIndex = input.findIndex((x: unknown) => {
        return Array.isArray(x) ? x.length !== expectedLength : true; // non-array value means the input is a tuple.
      });

      inputIsSingleTuple = firstNonUniformTupleValueIndex !== -1;
    } else {
      inputIsSingleTuple = true;
    }

    // first value of the tuple could also be an array. If it is, check the other tuples all have the same length.
    result = inputIsSingleTuple ? [input] : input;
  } else {
    result = input; // is an empty array.
  }

  return result;
}
