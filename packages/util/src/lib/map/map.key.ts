import { PrimativeKey, ReadKeyFunction, ReadMultipleKeysFunction } from '../key';
import { IterableOrValue, useIterableOrValue } from '../iterable';
import { Maybe } from '../value/maybe.type';
import { expandArrayMapTuples, mapToTuples } from './map';

/**
 * Creates a map by reading keys from the input values. Values without a key are ignored.
 */
export type KeyValueMapFactory<T, K extends PrimativeKey = PrimativeKey> = (values: T[]) => Map<K, T>;

/**
 * Creates a KeyValueMapFactory with the input ReadKeyFunction.
 *
 * @param read
 * @returns
 */
export function keyValueMapFactory<T, K extends PrimativeKey = PrimativeKey>(read: ReadKeyFunction<T, K>): KeyValueMapFactory<T, K> {
  return (values: T[]) => {
    const map = new Map<K, T>();

    values.forEach((x) => {
      const key = read(x);

      if (key != null) {
        map.set(key, x);
      }
    });

    return map;
  };
}

/**
 * Reads keys off the input values and places them in a Map using a ReadKeyFunction.
 *
 * @param values
 * @param read
 * @returns
 */
export function readKeysToMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], read: ReadKeyFunction<T, K>): Map<K, T> {
  return keyValueMapFactory(read)(values);
}

/**
 * Creates a KeyValueMapFactory with the input ReadMultipleKeysFunction.
 *
 * @param read
 * @returns
 */
export function multiKeyValueMapFactory<T, K extends PrimativeKey = PrimativeKey>(read: ReadMultipleKeysFunction<T, K>): KeyValueMapFactory<T, K> {
  return (values: T[]) => {
    const map = new Map<K, T>();

    values.forEach((x) => {
      const keys = read(x) ?? [];
      keys.forEach((key) => map.set(key, x));
    });

    return map;
  };
}

/**
 * Reads keys off the input values and places them in a Map using a ReadMultipleKeysFunction.
 *
 * @param values
 * @param read
 * @returns
 */
export function readMultipleKeysToMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], read: ReadMultipleKeysFunction<T, K>): Map<K, T> {
  return multiKeyValueMapFactory(read)(values);
}

/**
 * Map with an array of values for a key.
 */
export type MultiValueMap<T, K extends PrimativeKey = PrimativeKey> = Map<Maybe<K>, T[]>;

/**
 * Interface for adding key/value pairs to a map that contains an array of values.
 */
export interface MultiValueMapBuilder<T, K extends PrimativeKey = PrimativeKey> {
  map(): MultiValueMap<T, K>;
  entries(): [Maybe<K>, T[]][];
  tuples(): [Maybe<K>, T][];
  delete(key: Maybe<K>): void;
  add(key: Maybe<K>, value: IterableOrValue<T>): void;
}

/**
 * Creates a new MultiValueMapBuilder
 *
 * @returns
 */
export function multiValueMapBuilder<T, K extends PrimativeKey = PrimativeKey>(): MultiValueMapBuilder<T, K> {
  const map = new Map<Maybe<K>, T[]>();

  const builder: MultiValueMapBuilder<T, K> = {
    map: () => map,
    entries: () => mapToTuples(map),
    tuples: () => expandArrayMapTuples(map),
    delete: (key: Maybe<K>) => {
      map.delete(key);
    },
    add: (key: Maybe<K>, value: IterableOrValue<T>) => {
      let array = map.get(key);

      if (array == null) {
        array = [];
        map.set(key, array);
      }

      useIterableOrValue(value, (x) => (array as T[]).push(x));
    }
  };

  return builder;
}
/**
 * Determines if two maps have the same keys.
 *
 * @param a - The first map
 * @param b - The second map
 * @returns true if the maps have the same keys, false otherwise
 */
export function mapsHaveSameKeys<K extends PrimativeKey>(a: Map<K, any>, b: Map<K, any>): boolean {
  if (a.size !== b.size) {
    return false; // must be same size to have same keys
  }

  for (const key of a.keys()) {
    if (!b.has(key)) {
      return false; // b does not have the same key as a
    }
  }

  return true;
}
