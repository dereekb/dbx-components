import { type ArrayOrValue, asArray } from '../array/array';
import { useIterableOrValue } from '../iterable/iterable';
import { type Maybe } from '../value/maybe.type';

/**
 * Combines multiple Maps into a single Map. Later maps override earlier values for the same key.
 *
 * @param maps - The maps to combine (null/undefined maps are skipped)
 * @returns A new Map containing all entries
 */
export function combineMaps<K, T>(...maps: Maybe<Map<K, T>>[]): Map<K, T> {
  const result = new Map<K, T>();

  maps.forEach((map) => {
    map?.forEach((x, key) => result.set(key, x));
  });

  return result;
}

/**
 * Sets the same value for one or more keys in a Map.
 *
 * @param map - The map to set values on
 * @param key - A single key or array of keys to set
 * @param value - The value to set for all keys
 * @returns The modified map
 */
export function setKeysOnMap<K, T>(map: Map<K, T>, key: ArrayOrValue<K>, value: T): Map<K, T> {
  asArray(key).forEach((key) => map.set(key, value));
  return map;
}

/**
 * Converts a Map to an array of key-value tuples.
 *
 * @param map - The map to convert
 * @returns An array of [key, value] tuples
 */
export function mapToTuples<K, T>(map: Map<K, T>): [K, T][] {
  return Array.from(map.entries());
}

/**
 * Expands a Map with array values into individual key/value tuples.
 *
 * @param map - A Map where values are arrays
 * @returns An array of [key, value] tuples, one for each element in each array
 */
export function expandArrayMapTuples<K, T>(map: Map<K, T[]>): [K, T][] {
  return expandArrayValueTuples(mapToTuples(map));
}

/**
 * Expands tuples where values may be arrays into individual key/value tuples.
 *
 * @param values - Array of [key, ArrayOrValue] tuples to expand
 * @returns An array of [key, value] tuples
 */
export function expandArrayValueTuples<K, T>(values: [K, ArrayOrValue<T>][]): [K, T][] {
  const tuples: [K, T][] = [];

  values.forEach(([key, values]) => {
    useIterableOrValue(values, (value) => {
      tuples.push([key, value]);
    });
  });

  return tuples;
}
