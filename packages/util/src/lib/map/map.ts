import { ArrayOrValue, asArray } from "../array";
import { Maybe } from "../value";

export type MapFn<A, B> = (value: A) => B;
export type MapStringFn<T> = MapFn<string, T>;

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
