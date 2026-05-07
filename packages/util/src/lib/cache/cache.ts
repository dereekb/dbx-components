import { type Maybe } from '../value/maybe.type';

/**
 * Async cache for a single value of type T.
 *
 * Implementations may be in-memory, file-backed, network-backed, or composed via
 * {@link memoizeAsyncValueCache} / {@link mergeAsyncValueCaches}.
 */
export interface AsyncValueCache<T> {
  /**
   * Loads the value from the cache, or returns null/undefined when no value is stored.
   */
  load(): Promise<Maybe<T>>;
  /**
   * Stores the value in the cache, replacing any previously stored value.
   */
  update(value: T): Promise<void>;
  /**
   * Removes the stored value and any persistent backing.
   */
  clear(): Promise<void>;
}

/**
 * Async cache for a record of T entries keyed by string.
 *
 * Implementations may be in-memory, file-backed (one file holds all keys), or composed.
 */
export interface AsyncKeyedValueCache<T> {
  /**
   * Loads the full record from the cache. Returns an empty object when the cache is empty.
   */
  load(): Promise<Record<string, T>>;
  /**
   * Returns the entry for the given key, or null/undefined when no entry is stored.
   */
  get(key: string): Promise<Maybe<T>>;
  /**
   * Stores the entry for the given key, replacing any previous entry at that key.
   */
  set(key: string, value: T): Promise<void>;
  /**
   * Removes the entry for the given key, leaving other keys intact.
   */
  remove(key: string): Promise<void>;
  /**
   * Removes all entries and any persistent backing.
   */
  clear(): Promise<void>;
}
