import { type PrimativeKey, type ReadKeyFunction } from '../key';
import { type Maybe } from '../value/maybe.type';

/**
 * Maps the values of the input array to a Map, keyed by the result of a key function.
 * Optionally transforms each value using a value function.
 *
 * @param values - source array of items to map
 * @param keyFn - function to extract a key from each item
 * @param valueFn - optional function to transform each item into the desired map value
 * @returns a Map of keys to values derived from the input array
 */
export function arrayToMap<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => V): Map<Maybe<K>, V>;
export function arrayToMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => T): Map<Maybe<K>, T>;
export function arrayToMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>): Map<Maybe<K>, T>;
export function arrayToMap<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => V = (t) => t as unknown as V): Map<Maybe<K>, V> {
  return new Map<Maybe<K>, V>(values.map((x) => [keyFn(x), valueFn(x)]));
}

/**
 * Maps the values of the input array to a Record object, keyed by the result of a key function.
 * Items with undefined keys are omitted. Optionally transforms each value using a value function.
 *
 * @param values - source array of items to map
 * @param keyFn - function to extract a key from each item
 * @param valueFn - optional function to transform each item into the desired record value
 * @returns a Record of keys to values derived from the input array
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
 * Returns values for each key, reusing existing items when available and generating new ones for missing keys.
 *
 * @param keys - the keys to resolve values for
 * @param existing - array of pre-existing items to check against
 * @param readKey - function to extract a key from an existing item
 * @param generateFn - function to create a new item for a key not found in existing items
 * @returns an array of items corresponding to each input key, in the same order
 */
// eslint-disable-next-line @typescript-eslint/max-params
export function generateIfDoesNotExist<T, K extends PrimativeKey = PrimativeKey>(keys: K[], existing: T[], readKey: ReadKeyFunction<T, K>, generateFn: (key: K) => T): T[] {
  const map = arrayToMap(existing, readKey);

  return keys.map((x) => {
    return map.get(x) ?? generateFn(x);
  });
}
