import { ArrayOrValue, asArray } from '../array/array';
import { useIterableOrValue } from '../iterable/iterable';
import { Maybe } from '../value/maybe.type';

/**
 *
 * @param maps
 * @returns
 */
export function combineMaps<K, T>(...maps: Maybe<Map<K, T>>[]): Map<K, T> {
  const result = new Map<K, T>();

  maps.forEach((map) => {
    map?.forEach((x, key) => result.set(key, x));
  });

  return result;
}

/**
 * Sets the value to all of the input keys.
 *
 * @param map
 * @param key
 * @param value
 * @returns
 */
export function setKeysOnMap<K, T>(map: Map<K, T>, key: ArrayOrValue<K>, value: T): Map<K, T> {
  asArray(key).forEach((key) => map.set(key, value));
  return map;
}

/**
 * Returns the array of entries from the map as tuples.
 *
 * @param map
 * @returns
 */
export function mapToTuples<K, T>(map: Map<K, T>): [K, T][] {
  return Array.from(map.entries());
}

/**
 * Expands a map that has array values into key/value tuples.
 *
 * @param map
 * @returns
 */
export function expandArrayMapTuples<K, T>(map: Map<K, T[]>): [K, T][] {
  return expandArrayValueTuples(mapToTuples(map));
}

/**
 * Expands the input tuples that may be an ArrayOrValue into tuples that are only key/value tuples.
 *
 * @param values
 * @returns
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
