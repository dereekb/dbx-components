import { PrimativeKey, ReadKeyFunction } from "../key";
import { Maybe } from "../value/maybe";

/**
 * Maps the values of the input array to a Map. Can additionally specify a value function to map out the input value to another value for the map.
 */
export function arrayToMap<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => V): Map<Maybe<K>, V>;
export function arrayToMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => T): Map<Maybe<K>, T>;
export function arrayToMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>): Map<Maybe<K>, T>;
export function arrayToMap<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => V = ((t) => t as any as V)): Map<Maybe<K>, V> {
  return new Map<Maybe<K>, V>(values.map(x => [keyFn(x), valueFn(x)]));
}

/**
 * Generates a value for the input
 * 
 * @param keys
 * @param existing 
 * @param readKey 
 * @param generateFn 
 * @returns 
 */
export function generateIfDoesNotExist<T, K extends PrimativeKey = PrimativeKey>(keys: K[], existing: T[], readKey: ReadKeyFunction<T, K>, generateFn: (key: K) => T): T[] {
  const map = arrayToMap(existing, readKey);

  return keys.map(x => {
    const value = map.get(x) ?? generateFn(x);
    return value;
  });
}
