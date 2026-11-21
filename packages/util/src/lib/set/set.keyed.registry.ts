import { type ArrayToObjectDuplicateKeyErrorFactory } from '../array/array.map';
import { type PrimativeKey, type ReadRequiredKeyFunction } from '../key';
import { type Maybe } from '../value/maybe.type';
import { HashSet } from './set.hashset';

/**
 * Configuration for {@link createKeyedRegistry}.
 */
export interface KeyedRegistryConfig<T, K extends PrimativeKey = PrimativeKey> {
  /**
   * Reads the unique key each value is registered under.
   */
  readonly readKey: ReadRequiredKeyFunction<T, K>;
  /**
   * Whether registering a different value under an already-registered key throws.
   *
   * - Absent or `false` (default): the new value replaces the old one in place (it keeps the original slot) and
   *   `register()` returns `false`.
   * - `true`: throws a default error naming the key.
   * - A factory: throws the error the factory returns.
   *
   * Re-registering the SAME instance is always a no-op that returns `false`, even when throwing is enabled.
   */
  readonly throwOnDuplicateKey?: Maybe<boolean | ArrayToObjectDuplicateKeyErrorFactory<T, K>>;
  /**
   * Values registered in order (through `register()`) when the registry is created.
   */
  readonly seed?: Maybe<Iterable<T>>;
}

/**
 * A mutable, insertion-ordered registry of values keyed by a key read from each value.
 *
 * A map-like facade (its `keys()` returns the keys) composed over a {@link HashSet}, which supplies the storage, the
 * order and the replace-in-place rule.
 */
export interface KeyedRegistry<T, K extends PrimativeKey = PrimativeKey> {
  /**
   * Registers a value under its key.
   *
   * @param value - The value to register.
   * @returns `true` when the key was new, `false` when it was already registered.
   * @throws {Error} When `throwOnDuplicateKey` is enabled and a different value is already registered under the key.
   */
  register(value: T): boolean;
  /**
   * Removes the value registered under a key.
   *
   * @param key - The key to remove.
   * @returns `true` when a value was removed.
   */
  unregister(key: K): boolean;
  /**
   * Removes every value.
   */
  clear(): void;
  /**
   * Whether a value is registered under the key.
   *
   * @param key - The key to check; a nullish key is never registered.
   * @returns `true` when the key is registered.
   */
  has(key: Maybe<K>): boolean;
  /**
   * The value registered under the key, if any.
   *
   * @param key - The key to read; a nullish key reads nothing.
   * @returns The registered value, or `undefined`.
   */
  get(key: Maybe<K>): Maybe<T>;
  /**
   * A fresh array of the registered keys, in registration order.
   *
   * @returns The keys.
   */
  keys(): K[];
  /**
   * A fresh array of the registered values, in registration order.
   *
   * @returns The values.
   */
  values(): T[];
  /**
   * The number of registered values.
   */
  readonly size: number;
}

/**
 * Creates a {@link KeyedRegistry}: an insertion-ordered, mutable registry of values keyed by `readKey`.
 *
 * Lookups by a secondary property (e.g. "every value of a kind") are `values().filter(...)`; "the last registered" is
 * its `.at(-1)`.
 *
 * @param config - The key reader, the duplicate-key rule and the optional seed values.
 * @returns A new registry.
 * @throws {Error} When `throwOnDuplicateKey` is enabled and `seed` contains two different values with the same key.
 *
 * @dbxUtil
 * @dbxUtilCategory set
 * @dbxUtilKind factory
 * @dbxUtilTags registry, keyed, map, set, register, lookup, duplicate
 * @dbxUtilRelated hash-set, array-to-object
 *
 * @example
 * ```ts
 * const registry = createKeyedRegistry<{ id: string; kind: string }, string>({ readKey: (x) => x.id, seed: [{ id: 'a', kind: 'x' }] });
 * registry.register({ id: 'b', kind: 'y' }); // true
 * registry.get('a'); // { id: 'a', kind: 'x' }
 * registry.keys(); // ['a', 'b']
 * registry.values().filter((x) => x.kind === 'y'); // [{ id: 'b', kind: 'y' }]
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createKeyedRegistry<T, K extends PrimativeKey = PrimativeKey>(config: KeyedRegistryConfig<T, K>): KeyedRegistry<T, K> {
  const { readKey, throwOnDuplicateKey } = config;
  const set = new HashSet<K, T>({ readKey });
  let duplicateKeyError: Maybe<ArrayToObjectDuplicateKeyErrorFactory<T, K>>;

  if (typeof throwOnDuplicateKey === 'function') {
    duplicateKeyError = throwOnDuplicateKey;
  } else if (throwOnDuplicateKey) {
    duplicateKeyError = (key) => new Error(`keyed-registry: key '${String(key)}' is already registered.`);
  }

  const register = (value: T): boolean => {
    const key = readKey(value);
    const existing = set.valueForKey(key);
    const isNew = existing === undefined && !set.hasKeyValue(key);

    if (!isNew && existing !== value && duplicateKeyError != null) {
      throw duplicateKeyError(key, value);
    }

    // HashSet replaces an existing key's value in place, keeping its original slot.
    set.add(value);
    return isNew;
  };

  const unregister = (key: K): boolean => {
    const hadKey = set.hasKeyValue(key);

    if (hadKey) {
      set.delete(set.valueForKey(key) as T);
    }

    return hadKey;
  };

  if (config.seed != null) {
    for (const value of config.seed) {
      register(value);
    }
  }

  return {
    register,
    unregister,
    clear: () => set.clear(),
    has: (key) => key != null && set.hasKeyValue(key),
    get: (key) => (key == null ? undefined : set.valueForKey(key)),
    keys: () => set.valuesArray().map(readKey),
    values: () => set.valuesArray(),
    get size() {
      return set.size;
    }
  };
}
