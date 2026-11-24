import { assertLimitedCollectionLimit, DEFAULT_LIMITED_COLLECTION_ORDER, type LimitedCollectionOrder } from '../map/map.limit';
import { type Maybe } from '../value/maybe.type';

/**
 * Called with each value a size-limited set evicts, after it was deleted.
 */
export type LimitedSetEvictFunction<T> = (value: T) => void;

/**
 * Configuration for {@link limitSet}.
 */
export interface LimitSetConfig<T> {
  /**
   * The most values the set keeps. A limit below 0 empties it.
   */
  readonly limit: number;
  /**
   * Called with each evicted value, oldest first, after it was deleted.
   */
  readonly onEvict?: Maybe<LimitedSetEvictFunction<T>>;
}

/**
 * Trims a set to its limit, ONCE: deletes its oldest values, in iteration order, until `size <= limit`.
 *
 * The one-shot sibling of {@link limitArray}, and the eviction loop {@link LimitedSet} runs after every insert.
 *
 * @param set - The set to trim, in place.
 * @param config - The limit, and the callback that receives each evicted value.
 * @returns The same set.
 *
 * @dbxUtil
 * @dbxUtilCategory set
 * @dbxUtilKind function
 * @dbxUtilTags set, limit, cap, trim, evict, truncate, size, oldest
 * @dbxUtilRelated limited-set, limit-map, limit-array
 *
 * @example
 * ```ts
 * const set = new Set(['a', 'b', 'c']);
 * limitSet(set, { limit: 2 }); // Set { 'b', 'c' }
 * ```
 */
export function limitSet<T, S extends Set<T> = Set<T>>(set: S, config: LimitSetConfig<T>): S {
  const { limit, onEvict } = config;

  // checked first so an insert under the limit allocates no iterator
  if (set.size > limit) {
    // deleting a value already visited is safe while iterating a Set; the loop stops as soon as the cap holds
    for (const value of set) {
      if (set.size <= limit) {
        break;
      }

      set.delete(value);
      onEvict?.(value);
    }
  }

  return set;
}

/**
 * Configuration for a {@link LimitedSet}.
 */
export interface LimitedSetConfig<T> extends LimitSetConfig<T> {
  /**
   * The most values the set keeps. Must be a positive integer.
   */
  readonly limit: number;
  /**
   * Which value is the oldest. Defaults to {@link DEFAULT_LIMITED_COLLECTION_ORDER} (`'recent'`, least-recently-used).
   */
  readonly order?: Maybe<LimitedCollectionOrder>;
}

/**
 * A `Set` that never holds more than `limit` values: an add that takes it past its limit evicts the oldest value.
 *
 * With `order: 'recent'` (the default) a re-`add` of an existing value moves it to the end (least-recently-used). With
 * `order: 'insertion'` nothing refreshes a value (FIFO). `has` never changes the order.
 *
 * Only `add` is overridden; `delete`, `clear`, `size`, `forEach` and the iterators are the native ones.
 *
 * @dbxUtil
 * @dbxUtilCategory set
 * @dbxUtilKind class
 * @dbxUtilTags set, limit, cap, lru, fifo, evict, bounded, size, seen
 * @dbxUtilRelated limit-set, limited-map
 *
 * @example
 * ```ts
 * const seen = new LimitedSet<string>({ limit: 2 });
 * seen.add('a').add('b');
 * seen.add('a'); // refreshes 'a'
 * seen.add('c'); // evicts 'b', the least recently added
 * ```
 */
export class LimitedSet<T> extends Set<T> {
  /**
   * The most values the set keeps.
   */
  readonly limit: number;
  /**
   * Which value is the oldest.
   */
  readonly order: LimitedCollectionOrder;
  private readonly _onEvict: Maybe<LimitedSetEvictFunction<T>>;

  /**
   * @param config - The limit, the order and the eviction callback.
   * @param values - Initial values, added in order — the set is trimmed as they go.
   * @throws {RangeError} When the limit is not a positive integer.
   */
  constructor(config: LimitedSetConfig<T>, values?: Maybe<Iterable<T>>) {
    // the native constructor would call this.add for an iterable BEFORE the fields below exist, so none is passed
    super();
    this.limit = assertLimitedCollectionLimit(config.limit);
    this.order = config.order ?? DEFAULT_LIMITED_COLLECTION_ORDER;
    this._onEvict = config.onEvict;

    if (values != null) {
      for (const value of values) {
        this.add(value);
      }
    }
  }

  /**
   * Adds a value, then evicts the oldest values past the limit. Under `'recent'` order an existing value becomes the
   * most recent.
   *
   * @param value - The value to add.
   * @returns This set.
   */
  override add(value: T): this {
    if (this.order === 'recent') {
      super.delete(value);
    }

    super.add(value);
    return limitSet(this, { limit: this.limit, onEvict: this._onEvict });
  }
}
