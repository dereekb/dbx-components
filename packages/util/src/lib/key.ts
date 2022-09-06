import { MapArrayFunction, MapFunction } from './value/map';
import { mapArrayFunction } from './value';
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
 * Reads all defined keys from the input objects.
 */
export type ReadKeysFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T[], K[]>;

/**
 * Creates a ReadKeysFunction using a ReadKeyFunction.
 *
 * @param read
 */
export function readKeysFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>): ReadKeysFunction<T, K> {
  return (values: T[]) => {
    const keys: K[] = new Array(values.length);

    values.forEach((x) => {
      const key = readKey(x);

      if (key != null) {
        keys.push(key);
      }
    });

    return keys;
  };
}

/**
 * Reads all defined keys from the input objects to a Set.
 */
export type ReadKeysSetFunction<T, K extends PrimativeKey = PrimativeKey> = MapFunction<T[], Set<K>>;

export function readKeysSetFunction<T, K extends PrimativeKey = PrimativeKey>(readKey: ReadKeyFunction<T, K>): ReadKeysSetFunction<T, K> {
  return (values: T[]) => {
    const keys = new Set<K>();

    values.forEach((x) => {
      const key = readKey(x);

      if (key != null) {
        keys.add(key);
      }
    });

    return keys;
  };
}
