import { type PrimativeKey, type ReadKeyFunction } from '../key';
import { type Maybe } from '../value/maybe.type';

/**
 * Maps the values of the input array to a Map. Can additionally specify a value function to map out the input value to another value for the map.
 */
export function arrayToMap<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => V): Map<Maybe<K>, V>;
export function arrayToMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => T): Map<Maybe<K>, T>;
export function arrayToMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>): Map<Maybe<K>, T>;
export function arrayToMap<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => V = (t) => t as unknown as V): Map<Maybe<K>, V> {
  return new Map<Maybe<K>, V>(values.map((x) => [keyFn(x), valueFn(x)]));
}

/**
 * Maps the values of the input array to a Record object. Can additionally specify a value function to map out the input value to another value for the map.
 */
export function arrayToObject<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => V): Record<K, V>;
export function arrayToObject<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => T): Record<K, T>;
export function arrayToObject<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>): Record<K, T>;
export function arrayToObject<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => V = (t) => t as unknown as V): Record<K, V> {
  const record: Record<K, V> = {} as Record<K, V>;

  values.map((x) => {
    const key = keyFn(x);
    const value = valueFn(x);

    if (key != undefined) {
      record[key] = value;
    }
  });

  return record;
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

  return keys.map((x) => {
    const value = map.get(x) ?? generateFn(x);
    return value;
  });
}
