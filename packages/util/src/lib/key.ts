import { type ArrayOrValue, asArray, pushItemOrArrayItemsIntoArray } from './array/array';
import { type MapFunction } from './value/map';
import { type Maybe } from './value/maybe.type';

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
 * Reads a key value from the input object that is required to exist.
 */
export type ReadRequiredKeyFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T, K>;

/**
 * Reads all keys from the input object. Can return null/undefined.
 */
export type ReadAllKeysFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T, Maybe<ArrayOrValue<K>>>;

/**
 * Reads one or more keys from the input object.
 */
export type ReadOneOrMoreKeysFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T, ArrayOrValue<K>>;

/**
 * Reads multiple keys from the input object.
 */
export type ReadMultipleKeysFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T, K[]>;

/**
 * Reads multiple keys from the input object or objects
 */
export type ReadKeysFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<ArrayOrValue<T>, K[]>;

/**
 * Creates a {@link ReadKeysFunction} from a key-reading function. Handles both single and array inputs,
 * filtering out null/undefined keys.
 *
 * @param readKey - Function that extracts one or more keys from a value.
 * @returns A function that reads keys from a single value or array of values.
 *
 * @example
 * ```ts
 * const fn = readKeysFunction<string>((x) => x);
 * fn(['a', 'b', 'c']); // ['a', 'b', 'c']
 * ```
 */
export function readKeysFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): ReadKeysFunction<T, K> {
  return (values: ArrayOrValue<T>) => {
    let result: K[];

    if (Array.isArray(values)) {
      result = [];

      values.forEach((x) => {
        const key = readKey(x);

        if (key != null) {
          pushItemOrArrayItemsIntoArray(result, key);
        }
      });
    } else {
      result = asArray(readKey(values));
    }

    return result;
  };
}

/**
 * Convenience function that reads all keys from an array of values using the provided key-reading function.
 *
 * @param readKey - Function that extracts one or more keys from a value.
 * @param values - Values to read keys from.
 * @returns An array of all extracted keys.
 */
export function readKeysFrom<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>, values: T[]): K[] {
  return readKeysFunction(readKey)(values);
}

/**
 * Reads all defined keys from the input objects to a Set.
 */
export type ReadKeysSetFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T[], Set<K>>;

/**
 * Creates a {@link ReadKeysSetFunction} from a key-reading function. Like {@link readKeysFunction} but returns a Set, deduplicating keys.
 *
 * @param readKey - Function that extracts one or more keys from a value.
 * @returns A function that reads keys from values into a Set.
 *
 * @example
 * ```ts
 * const fn = readKeysSetFunction<string>((x) => x);
 * fn(['a', 'b', 'a']); // Set { 'a', 'b' }
 * ```
 */
export function readKeysSetFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>): ReadKeysSetFunction<T, K> {
  return (values: ArrayOrValue<T>) => {
    let result: Set<K>;

    if (Array.isArray(values)) {
      result = new Set<K>();

      values.forEach((x) => {
        const key = readKey(x);

        if (key != null) {
          if (Array.isArray(key)) {
            key.forEach((x) => result.add(x));
          } else {
            result.add(key);
          }
        }
      });
    } else {
      result = new Set<K>(asArray(readKey(values)));
    }

    return result;
  };
}

/**
 * Convenience function that reads all keys from an array of values into a Set using the provided key-reading function.
 *
 * @param readKey - Function that extracts one or more keys from a value.
 * @param values - Values to read keys from.
 * @returns A Set of all extracted keys.
 */
export function readKeysSetFrom<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K> | ReadMultipleKeysFunction<T, K>, values: T[]): Set<K> {
  return readKeysSetFunction(readKey)(values);
}
