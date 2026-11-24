import { type Maybe } from '../value/maybe.type';

/**
 * Which entry a size-limited collection treats as the OLDEST, and so evicts first.
 *
 * - `'recent'` — least-recently-used: a read of a present entry and a re-insert of an existing one move it to the end.
 * - `'insertion'` — first-in, first-out: nothing refreshes an entry, so the first inserted is the first evicted.
 */
export type LimitedCollectionOrder = 'recent' | 'insertion';

/**
 * The {@link LimitedCollectionOrder} a {@link LimitedMap} / `LimitedSet` uses when its config names none.
 */
export const DEFAULT_LIMITED_COLLECTION_ORDER: LimitedCollectionOrder = 'recent';

/**
 * Asserts a size-limited collection's limit is a positive integer.
 *
 * @param limit - The limit to check.
 * @returns The limit, unchanged.
 * @throws {RangeError} When the limit is not a positive integer.
 */
export function assertLimitedCollectionLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`A limited collection's limit must be a positive integer (got ${limit}).`);
  }

  return limit;
}

/**
 * Called with each entry a size-limited map evicts, after it was deleted.
 */
export type LimitedMapEvictFunction<K, V> = (key: K, value: V) => void;

/**
 * Configuration for {@link limitMap}.
 */
export interface LimitMapConfig<K, V> {
  /**
   * The most entries the map keeps. A limit below 0 empties it.
   */
  readonly limit: number;
  /**
   * Called with each evicted entry, oldest first, after it was deleted.
   */
  readonly onEvict?: Maybe<LimitedMapEvictFunction<K, V>>;
}

/**
 * Trims a map to its limit, ONCE: deletes its oldest entries, in iteration order, until `size <= limit`.
 *
 * The one-shot sibling of {@link limitArray}, and the eviction loop {@link LimitedMap} runs after every insert.
 *
 * @param map - The map to trim, in place.
 * @param config - The limit, and the callback that receives each evicted entry.
 * @returns The same map.
 *
 * @dbxUtil
 * @dbxUtilCategory map
 * @dbxUtilKind function
 * @dbxUtilTags map, limit, cap, trim, evict, truncate, size, oldest
 * @dbxUtilRelated limited-map, limit-set, limit-array
 *
 * @example
 * ```ts
 * const map = new Map([['a', 1], ['b', 2], ['c', 3]]);
 * limitMap(map, { limit: 2 }); // Map { 'b' => 2, 'c' => 3 }
 * ```
 */
export function limitMap<K, V, M extends Map<K, V> = Map<K, V>>(map: M, config: LimitMapConfig<K, V>): M {
  const { limit, onEvict } = config;

  // checked first so an insert under the limit allocates no iterator
  if (map.size > limit) {
    // deleting an entry already visited is safe while iterating a Map; the loop stops as soon as the cap holds
    for (const [key, value] of map) {
      if (map.size <= limit) {
        break;
      }

      map.delete(key);
      onEvict?.(key, value);
    }
  }

  return map;
}

/**
 * Configuration for a {@link LimitedMap}.
 */
export interface LimitedMapConfig<K, V> extends LimitMapConfig<K, V> {
  /**
   * The most entries the map keeps. Must be a positive integer.
   */
  readonly limit: number;
  /**
   * Which entry is the oldest. Defaults to {@link DEFAULT_LIMITED_COLLECTION_ORDER} (`'recent'`, least-recently-used).
   */
  readonly order?: Maybe<LimitedCollectionOrder>;
}

/**
 * A `Map` that never holds more than `limit` entries: an insert that takes it past its limit evicts the oldest entry.
 *
 * With `order: 'recent'` (the default) it is an LRU cache — {@link LimitedMap.get} of a present key and a re-`set` of an
 * existing key move it to the end. With `order: 'insertion'` nothing refreshes an entry (FIFO). `has` never changes
 * the order.
 *
 * Only `set` and `get` are overridden; `delete`, `clear`, `size`, `forEach` and the iterators are the native ones.
 *
 * @dbxUtil
 * @dbxUtilCategory map
 * @dbxUtilKind class
 * @dbxUtilTags map, limit, cap, lru, cache, fifo, evict, bounded, size
 * @dbxUtilRelated limit-map, limited-set
 *
 * @example
 * ```ts
 * const cache = new LimitedMap<string, number>({ limit: 2 });
 * cache.set('a', 1).set('b', 2);
 * cache.get('a'); // refreshes 'a'
 * cache.set('c', 3); // evicts 'b', the least recently used
 * ```
 */
export class LimitedMap<K, V> extends Map<K, V> {
  /**
   * The most entries the map keeps.
   */
  readonly limit: number;
  /**
   * Which entry is the oldest.
   */
  readonly order: LimitedCollectionOrder;
  private readonly _onEvict: Maybe<LimitedMapEvictFunction<K, V>>;

  /**
   * @param config - The limit, the order and the eviction callback.
   * @param entries - Initial entries, inserted in order — the map is trimmed as they go.
   * @throws {RangeError} When the limit is not a positive integer.
   */
  constructor(config: LimitedMapConfig<K, V>, entries?: Maybe<Iterable<readonly [K, V]>>) {
    // the native constructor would call this.set for an iterable BEFORE the fields below exist, so none is passed
    super();
    this.limit = assertLimitedCollectionLimit(config.limit);
    this.order = config.order ?? DEFAULT_LIMITED_COLLECTION_ORDER;
    this._onEvict = config.onEvict;

    if (entries != null) {
      for (const [key, value] of entries) {
        this.set(key, value);
      }
    }
  }

  /**
   * Reads a key's value. Under `'recent'` order a present key becomes the most recent.
   *
   * @param key - The key to read.
   * @returns The value, or undefined when the key is absent.
   */
  override get(key: K): V | undefined {
    const value = super.get(key);

    if (this.order === 'recent' && super.has(key)) {
      super.delete(key);
      super.set(key, value as V);
    }

    return value;
  }

  /**
   * Sets a key's value, then evicts the oldest entries past the limit. Under `'recent'` order an existing key becomes
   * the most recent.
   *
   * @param key - The key to set.
   * @param value - Its value.
   * @returns This map.
   */
  override set(key: K, value: V): this {
    if (this.order === 'recent') {
      super.delete(key);
    }

    super.set(key, value);
    return limitMap(this, { limit: this.limit, onEvict: this._onEvict });
  }
}
