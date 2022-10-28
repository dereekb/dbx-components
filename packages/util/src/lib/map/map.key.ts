import { PrimativeKey, ReadKeyFunction, ReadMultipleKeysFunction } from '../key';

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
