import { type PrimativeKey, type ReadKeyFunction } from '../key';
import { type MapFunction } from '../value/map';
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
 * Builds the {@link Error} thrown by {@link arrayToObject} when two values share a key, given the key and the later value.
 */
export type ArrayToObjectDuplicateKeyErrorFactory<T, K extends PrimativeKey = PrimativeKey> = (key: K, value: T) => Error;

/**
 * Config-object form of {@link arrayToObject}.
 */
export interface ArrayToObjectConfig<T, K extends PrimativeKey = PrimativeKey, V = T> {
  /**
   * Reads the key of each value. Values with a null/undefined key are left out of the record.
   */
  readonly readKey: ReadKeyFunction<T, K>;
  /**
   * Maps each value to the value stored in the record.
   *
   * Defaults to the value itself.
   */
  readonly readValue?: Maybe<MapFunction<T, V>>;
  /**
   * Whether two values sharing a key throws an error.
   *
   * - unset/false: the last value wins, the same as the positional form.
   * - true: throws `arrayToObject(): duplicate key "<key>".`
   * - a function: throws the {@link Error} it returns, so a registry can keep its own message.
   *
   * Duplicates are detected with an own-property check, so keys such as `toString` or `constructor` are not false duplicates.
   */
  readonly throwOnDuplicateKey?: Maybe<boolean | ArrayToObjectDuplicateKeyErrorFactory<T, K>>;
}

/**
 * Maps the values of the input array to a Record object, keyed by the result of a key function.
 * Items with undefined keys are omitted. Optionally transforms each value using a value function.
 *
 * Also accepts an {@link ArrayToObjectConfig} as the second argument, which can throw when two values share a key instead of letting the last value win.
 *
 * @param values - source array of items to map
 * @param keyFn - function to extract a key from each item, or an {@link ArrayToObjectConfig}
 * @param valueFn - optional function to transform each item into the desired record value
 * @returns a Record of keys to values derived from the input array
 *
 * @example
 * ```ts
 * const byId = arrayToObject([{ id: 'a' }, { id: 'b' }], (x) => x.id);
 * // { a: { id: 'a' }, b: { id: 'b' } }
 *
 * const registry = arrayToObject(configs, {
 *   readKey: (x) => x.type,
 *   throwOnDuplicateKey: (type) => new Error(`duplicate type in registry: ${type}`)
 * });
 * ```
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, object, record, index, key, lookup, duplicate, unique, registry
 * @dbxUtilRelated is-unique-keyed-function, key-value-map-factory
 */
export function arrayToObject<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => V): Record<K, V>;
export function arrayToObject<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>, valueFn: (t: T) => T): Record<K, T>;
export function arrayToObject<T, K extends PrimativeKey = PrimativeKey>(values: T[], keyFn: ReadKeyFunction<T, K>): Record<K, T>;
export function arrayToObject<T, K extends PrimativeKey = PrimativeKey, V = T>(values: T[], config: ArrayToObjectConfig<T, K, V>): Record<K, V>;
export function arrayToObject<T, V, K extends PrimativeKey = PrimativeKey>(values: T[], keyFnOrConfig: ReadKeyFunction<T, K> | ArrayToObjectConfig<T, K, V>, valueFn?: (t: T) => V): Record<K, V> {
  const config: ArrayToObjectConfig<T, K, V> = typeof keyFnOrConfig === 'function' ? { readKey: keyFnOrConfig, readValue: valueFn } : keyFnOrConfig;
  const { readKey, readValue, throwOnDuplicateKey } = config;
  const record = {} as Record<K, V>;

  values.forEach((x) => {
    const key = readKey(x);

    if (key != null) {
      if (throwOnDuplicateKey && Object.hasOwn(record, key)) {
        throw typeof throwOnDuplicateKey === 'function' ? throwOnDuplicateKey(key, x) : new Error(`arrayToObject(): duplicate key "${String(key)}".`);
      }

      record[key] = readValue ? readValue(x) : (x as unknown as V);
    }
  });

  return record;
}

/**
 * Returns values for each key, reusing existing items when available and generating new ones for missing keys.
 *
 * @param keys - The keys to resolve values for.
 * @param existing - Array of pre-existing items to check against.
 * @param readKey - Function to extract a key from an existing item.
 * @param generateFn - Function to create a new item for a key not found in existing items.
 * @returns Items aligned to `keys` — reused when present in `existing`, generated otherwise.
 */
// eslint-disable-next-line @typescript-eslint/max-params
export function generateIfDoesNotExist<T, K extends PrimativeKey = PrimativeKey>(keys: K[], existing: T[], readKey: ReadKeyFunction<T, K>, generateFn: (key: K) => T): T[] {
  const map = arrayToMap(existing, readKey);

  return keys.map((x) => {
    return map.get(x) ?? generateFn(x);
  });
}
