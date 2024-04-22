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
 * Converts the input IterableOrValue value to an array.
 *
 * By default will treat strings as a non-iterable value, using the string as a single value.
 *
 * @param values
 * @param treatStringAsIterable
 * @returns
 */
export function iterableToArray<T = unknown>(values: IterableOrValue<T>, treatStringAsIterable?: boolean): T[] {
  let iterable: Array<T>;

  if (treatStringAsIterable && typeof values === 'string') {
    iterable = [values];
  } else if (isIterable(values)) {
    iterable = Array.from(values); // copy the array
  } else {
    iterable = [values];
  }

  return iterable;
}

/**
 * Converts the input IterableOrValue value to a Set.
 *
 * By default will treat strings as a non-iterable value, using the string as a single value.
 *
 * @param values
 * @param treatStringAsIterable
 * @returns
 */
export function iterableToSet<T = unknown>(values: IterableOrValue<T>, treatStringAsIterable = false): Set<T> {
  return new Set<T>(iterableToArray(values, treatStringAsIterable));
}

/**
 * Converts the input IterableOrValue value to a Map using the input readKey function.
 *
 * @param values
 * @param readKey
 * @returns
 */
export function iterableToMap<T, K extends PrimativeKey = PrimativeKey>(values: IterableOrValue<T>, readKey: ReadKeyFunction<T, K>): Map<Maybe<K>, T> {
  const map = new Map<Maybe<K>, T>(iterableToArray(values).map((value) => [readKey(value), value]));
  return map;
}

/**
 * Returns true if the input is an Iterable.
 *
 * Can specify whether or not to treat string values as iterable values. Is false by default.
 *
 * @param values
 * @param treatStringAsIterable
 * @returns
 */
export function isIterable<T = unknown>(values: unknown, treatStringAsIterable = false): values is Iterable<T> {
  if (values && (values as Iterable<T>)[Symbol.iterator] && (treatStringAsIterable || typeof values !== 'string')) {
    return true;
  } else {
    return false;
  }
}

/**
 * Returns true if there are values to iterate over.
 *
 * @param values
 * @returns
 */
export function isEmptyIterable<T = unknown>(values: Iterable<T>): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of values) {
    return false;
  }

  return true;
}

/**
 * Returns the first value from the Iterable. If there are no values, returns undefined. Order is not guranteed.
 *
 * @param values
 * @returns
 */
export function firstValueFromIterable<T>(values: Iterable<T>): Maybe<T> {
  for (const value of values) {
    return value;
  }

  return undefined;
}

/**
 * Takes items from the iterable in the order they are read. Order is not guranteed.
 *
 * @param values
 * @param count
 * @returns
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
 * Iterates over iterable values.
 *
 * @param values
 * @param fn
 */
export function forEachInIterable<T>(values: Iterable<T>, fn: (value: T) => void): void {
  for (const value of values) {
    fn(value);
  }
}

/**
 * Uses the input iterable if it is defined.
 *
 * @param values
 * @param fn
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
 * Find the first matching value in the Iterable.
 *
 * @param values
 * @param fn
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
 * Whether or not the value exists in the iterable.
 *
 * @param values
 * @param fn
 * @returns
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
 * Filters values from the iterable using a DecisionFunction.
 *
 * @param values
 * @param fn
 * @returns
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
 * Wraps the input tuple values as an array. The tuples should all be the same length in order to wrap them properly, and the tuple value cannot consist of only arrays of the same length.
 *
 * This is used to prevent functions from treating the tuple itself as an array.
 *
 * @param input
 */
export function wrapTuples<T>(input: IterableOrValue<T>): T[] {
  if (Array.isArray(input)) {
    // check if the first item is an array. Tuples can contain arrays as the first value.
    if (input.length > 0) {
      const firstValueInPotentialTupleOrArray = input[0];

      let inputIsSingleTuple = false;

      if (Array.isArray(firstValueInPotentialTupleOrArray)) {
        // if the first nested value is an array then the top-level value may be an array and not a tuple. Check the length of all the other values in the array to see if they have the same length.
        const expectedLength = firstValueInPotentialTupleOrArray.length;

        // if it is an array of tuples, all values should be the same length and be arrays. If not an array, then we're looking at a tuple.
        const firstNonUniformTupleValueIndex = input.findIndex((x: any) => {
          if (Array.isArray(x)) {
            return x.length !== expectedLength;
          } else {
            return true; // non-array value. The input is a tuple.
          }
        });

        inputIsSingleTuple = firstNonUniformTupleValueIndex !== -1;
      } else {
        inputIsSingleTuple = true;
        return [input];
      }

      // first value of the tuple could also be an array. If it is, check the other tuples all have the same length.
      if (inputIsSingleTuple) {
        return [input];
      } else {
        return input;
      }
    } else {
      return input; // is an empty array.
    }
  } else {
    throw new Error('Input is not an array/tuple...');
  }
}
