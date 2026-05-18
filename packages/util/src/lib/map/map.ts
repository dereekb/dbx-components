import { type ArrayOrValue, asArray } from '../array/array';
import { useIterableOrValue } from '../iterable/iterable';
import { type Maybe } from '../value/maybe.type';

/**
 * Combines multiple Maps into a single Map. Later maps override earlier values for the same key.
 *
 * @param maps - Lookups to merge; nullish entries are skipped.
 * @returns Combined lookup with later entries overriding earlier ones per key.
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
 * @param map - Lookup that receives the writes in place.
 * @param key - One or more keys to associate with `value`.
 * @param value - Payload assigned to every supplied key.
 * @returns Same `map` reference after the assignments.
 */
export function setKeysOnMap<K, T>(map: Map<K, T>, key: ArrayOrValue<K>, value: T): Map<K, T> {
  asArray(key).forEach((key) => map.set(key, value));
  return map;
}

/**
 * Converts a Map to an array of key-value tuples.
 *
 * @param map - Lookup whose entries should be flattened.
 * @returns Tuple list mirroring the lookup's entry iteration order.
 */
export function mapToTuples<K, T>(map: Map<K, T>): [K, T][] {
  return Array.from(map.entries());
}

/**
 * Expands a Map with array values into individual key/value tuples.
 *
 * @param map - Lookup whose values are arrays to expand.
 * @returns Flattened tuples — one per element across every keyed array.
 */
export function expandArrayMapTuples<K, T>(map: Map<K, T[]>): [K, T][] {
  return expandArrayValueTuples(mapToTuples(map));
}

/**
 * Expands tuples where values may be arrays into individual key/value tuples.
 *
 * @param values - Tuples whose right-hand side may be a single value or an array.
 * @returns Flattened tuples emitting one entry per element on each input tuple.
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
