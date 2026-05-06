import { type Maybe } from '../value/maybe.type';
import { type AsyncKeyedValueCache, type AsyncValueCache } from './cache';

/**
 * Wraps an inner {@link AsyncValueCache} with a single-load in-memory memoization layer.
 *
 * The first {@link AsyncValueCache.load} call delegates to the inner cache and stores the
 * result; subsequent calls return the memoized value without touching the inner cache again.
 * {@link AsyncValueCache.update} writes through to the inner cache and refreshes the memo.
 * {@link AsyncValueCache.clear} clears both layers.
 *
 * Note: the memoized value is per-process. Long-running processes will not observe writes
 * made by other processes to the inner backing once the memo is populated.
 */
export function memoizeAsyncValueCache<T>(inner: AsyncValueCache<T>): AsyncValueCache<T> {
  let loaded: Maybe<{ value: Maybe<T> }>;

  return {
    load: async () => {
      if (loaded == null) {
        loaded = { value: await inner.load() };
      }
      return loaded.value;
    },
    update: async (next) => {
      loaded = { value: next };
      await inner.update(next);
    },
    clear: async () => {
      loaded = { value: undefined };
      await inner.clear();
    }
  };
}

/**
 * Wraps an inner {@link AsyncKeyedValueCache} with a single-load in-memory memoization layer
 * over the full record.
 *
 * The first call to any read method ({@link AsyncKeyedValueCache.load} or {@link AsyncKeyedValueCache.get})
 * delegates to the inner cache and stores the loaded record; subsequent reads return entries
 * from the memoized record without re-hitting the inner cache. Writes ({@link AsyncKeyedValueCache.set} /
 * {@link AsyncKeyedValueCache.remove}) update the memoized record and write through to the inner cache.
 * {@link AsyncKeyedValueCache.clear} clears both layers.
 *
 * Note: the memoized record is per-process. Long-running processes will not observe writes
 * made by other processes to the inner backing once the memo is populated.
 */
export function memoizeAsyncKeyedValueCache<T>(inner: AsyncKeyedValueCache<T>): AsyncKeyedValueCache<T> {
  let loaded: Maybe<{ entries: Record<string, T> }>;

  async function ensureLoaded(): Promise<Record<string, T>> {
    if (loaded == null) {
      loaded = { entries: await inner.load() };
    }
    return loaded.entries;
  }

  return {
    load: async () => ({ ...(await ensureLoaded()) }),
    get: async (key) => (await ensureLoaded())[key],
    set: async (key, value) => {
      const current = await ensureLoaded();
      loaded = { entries: { ...current, [key]: value } };
      await inner.set(key, value);
    },
    remove: async (key) => {
      const current = await ensureLoaded();
      const next = { ...current };
      delete next[key];
      loaded = { entries: next };
      await inner.remove(key);
    },
    clear: async () => {
      loaded = { entries: {} };
      await inner.clear();
    }
  };
}
