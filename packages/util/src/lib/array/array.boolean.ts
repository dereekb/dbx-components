import { removeModelsWithKey, removeModelsWithSameKey, type ReadModelKeyFunction } from '../model/model';
import { type Maybe } from '../value/maybe.type';

/**
 * A string type used as a key in boolean arrays.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 */
export type BooleanStringKey = string;

/**
 * Boolean represented by an array to describe the current state and reason why.
 */
export type BooleanStringKeyArray = BooleanKeyArray<BooleanStringKey>;

/**
 * Boolean represented by an array to describe the current state and reason why.
 *
 * Having any values in the array is considered "true".
 */
export type BooleanKeyArray<T = string> = Maybe<T[]>;

/**
 * Wraps a key reading function to ensure that empty string keys are not used in boolean key arrays.
 *
 * @param readKey - The key reading function to wrap.
 * @returns A wrapped key reading function that throws an error if an empty string is used as a key.
 */
export function readBooleanKeySafetyWrap<T>(readKey: ReadModelKeyFunction<T>): ReadModelKeyFunction<T> {
  return (value: T) => {
    const key = readKey(value);

    if (key === '') {
      throw new Error('Cannot use "empty" string for BooleanKey.');
    } else {
      return key;
    }
  };
}

/**
 * Checks if a boolean key array evaluates to false (empty or undefined).
 *
 * @param value - Boolean-key array to evaluate as a tri-state.
 * @returns True when the array has no entries (treated as `false`); otherwise false.
 */
export function isFalseBooleanKeyArray(value: BooleanKeyArray): boolean {
  return !value || value.length <= 0;
}

/**
 * Checks if a boolean key array evaluates to true (has at least one value).
 *
 * @param value - Boolean-key array to evaluate as a tri-state.
 * @returns True when at least one entry exists (treated as `true`); otherwise false.
 */
export function isTrueBooleanKeyArray(value: BooleanKeyArray): boolean {
  return !isFalseBooleanKeyArray(value);
}

/**
 * Inserts a value into a boolean key array, removing any existing values with the same key.
 *
 * @param array - Existing boolean-key array to extend.
 * @param value - Entry to add, displacing any prior entry with the same key.
 * @param readKey - Resolver that derives the comparison key from an entry.
 * @returns Resulting boolean-key array containing the inserted entry.
 */
export function insertIntoBooleanKeyArray<T>(array: BooleanKeyArray<T>, value: T, readKey: ReadModelKeyFunction<T>): BooleanKeyArray<T> {
  return array ? [...removeModelsWithSameKey(array, value, readBooleanKeySafetyWrap(readKey)), value] : [value];
}

/**
 * Removes a value from a boolean key array based on its key.
 *
 * @param array - Existing boolean-key array to filter.
 * @param value - Entry whose key identifies the row to drop.
 * @param readKey - Resolver that derives the comparison key from an entry.
 * @returns Boolean-key array with entries matching the value's key removed.
 */
export function removeFromBooleanKeyArray<T>(array: BooleanKeyArray<T>, value: T, readKey: ReadModelKeyFunction<T>): BooleanKeyArray<T> {
  return array ? removeModelsWithSameKey(array, value, readBooleanKeySafetyWrap(readKey)) : array;
}

/**
 * Removes values from a boolean key array that match the specified key.
 *
 * @param array - Existing boolean-key array to filter.
 * @param key - Identifier whose entries should be removed.
 * @param readKey - Resolver that derives the comparison key from an entry.
 * @returns Boolean-key array with entries carrying the given key removed.
 */
export function removeByKeyFromBooleanKeyArray<T>(array: BooleanKeyArray<T>, key: string, readKey: ReadModelKeyFunction<T>): BooleanKeyArray<T> {
  return array ? removeModelsWithKey(array, key, readBooleanKeySafetyWrap(readKey)) : array;
}

/**
 * Utility type for working with boolean key arrays.
 */
export type BooleanKeyArrayUtility<T> = ReturnType<typeof booleanKeyArrayUtility<T>>;

/**
 * Creates a utility object with functions for working with boolean key arrays.
 *
 * @param readKey - Function to extract the key from a value.
 * @returns An object with utility functions for boolean key arrays.
 */
export function booleanKeyArrayUtility<T>(readKey: ReadModelKeyFunction<T>) {
  const isFalse = (value: BooleanKeyArray): boolean => {
    return isFalseBooleanKeyArray(value);
  };

  const isTrue = (value: BooleanKeyArray): boolean => {
    return isTrueBooleanKeyArray(value);
  };

  const set = (array: BooleanKeyArray<T>, value: T, enable: boolean = true): BooleanKeyArray<T> => {
    return enable ? insert(array, value) : remove(array, value);
  };

  const insert = (array: BooleanKeyArray<T>, value: T): BooleanKeyArray<T> => {
    return insertIntoBooleanKeyArray(array, value, readKey);
  };

  const remove = (array: BooleanKeyArray<T>, value: T): BooleanKeyArray<T> => {
    return removeFromBooleanKeyArray(array, value, readKey);
  };

  const removeByKey = (array: BooleanKeyArray<T>, key: string): BooleanKeyArray<T> => {
    return removeByKeyFromBooleanKeyArray(array, key, readKey);
  };

  return {
    isFalse,
    isTrue,
    set,
    insert,
    remove,
    removeByKey
  };
}

/**
 * Utility for working with boolean string key arrays.
 */
export const BooleanStringKeyArrayUtility = booleanKeyArrayUtility<BooleanStringKey>((x) => x || undefined);
