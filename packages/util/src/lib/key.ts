import { ArrayOrValue, asArray, mergeArrayOrValueIntoArray } from './array/array';
import { setContainsAllValues } from './set/set';
import { EqualityComparatorFunction, safeEqualityComparatorFunction } from './value/comparator';
import { MapFunction } from './value/map';
import { Maybe } from './value/maybe.type';

/**
 * A key made up of either a string or number value.
 */
export type PrimativeKey = string | number;

/**
 * A key of a type.
 */
export type FieldOfType<T> = keyof T;

/**
 * Reads a key from the input object.
 */
export type ReadKeyFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T, Maybe<K>>;

/**
 * Reads multiple keys from the input object.
 */
export type ReadMultipleKeysFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T, K[]>;

/**
 * Reads multiple keys from the input object or objects
 */
export type ReadKeysFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<ArrayOrValue<T>, K[]>;

/**
 * Creates a ReadKeysFromFunction using a ReadKeyFunction.
 *
 * @param read
 */
export function readKeysFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): ReadKeysFunction<T, K> {
  return (values: ArrayOrValue<T>) => {
    if (Array.isArray(values)) {
      const keys: K[] = [];

      values.forEach((x) => {
        const key = readKey(x);

        if (key != null) {
          mergeArrayOrValueIntoArray(keys, key);
        }
      });

      return keys;
    } else {
      return asArray(readKey(values));
    }
  };
}

/**
 * Convenience function for reading all the keys for the input values.
 * @param readKey
 * @param values
 * @returns
 */
export function readKeysFrom<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>, values: T[]): K[] {
  return readKeysFunction(readKey)(values);
}

/**
 * Reads all defined keys from the input objects to a Set.
 */
export type ReadKeysSetFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T[], Set<K>>;

export function readKeysSetFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): ReadKeysSetFunction<T, K> {
  return (values: ArrayOrValue<T>) => {
    if (Array.isArray(values)) {
      const keys = new Set<K>();

      values.forEach((x) => {
        const key = readKey(x);

        if (key != null) {
          if (Array.isArray(key)) {
            key.forEach((x) => keys.add(x));
          } else {
            keys.add(key);
          }
        }
      });

      return keys;
    } else {
      return new Set<K>(asArray(readKey(values)));
    }
  };
}

/**
 * Convenience function for reading all the keys for the input values.
 * @param readKey
 * @param values
 * @returns
 */
export function readKeysSetFrom<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>, values: T[]): Set<K> {
  return readKeysSetFunction(readKey)(values);
}

/**
 * Creates a EqualityComparatorFunction that compares the two input values
 *
 * @param readKey
 * @returns
 */
export function objectKeysEqualityComparatorFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): EqualityComparatorFunction<Maybe<T[]>> {
  const readKeysSet = readKeysSetFunction(readKey);
  const readKeysArray = readKeysFunction(readKey);

  return safeEqualityComparatorFunction((a: T[], b: T[]) => {
    if (a.length === b.length) {
      if (a.length === 0) {
        return true; // both the same/empty arrays
      }

      const aKeys = readKeysSet(a);
      const bKeys = readKeysArray(b);

      if (aKeys.size === bKeys.length) {
        return setContainsAllValues(aKeys, bKeys);
      }
    }

    return false;
  });
}

/**
 * Creates a EqualityComparatorFunction that compares the two input values
 *
 * @param readKey
 * @returns
 */
export function objectKeyEqualityComparatorFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>): EqualityComparatorFunction<Maybe<T>> {
  return safeEqualityComparatorFunction((a, b) => readKey(a) === readKey(b));
}
