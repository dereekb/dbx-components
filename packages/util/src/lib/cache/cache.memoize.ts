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
 *
 * @dbxUtil
 * @dbxUtilCategory cache
 * @dbxUtilTags memoize, memo, cache, async, single-load, async-value
 * @dbxUtilRelated memoize-async-keyed-value-cache
 *
 * @param inner - The backing cache to memoize. Reads are delegated once and cached; writes are forwarded through and refresh the memo.
 * @returns An {@link AsyncValueCache} that proxies the inner cache with a single-load memoization layer.
 *
 * @example
 * ```ts
 * const memo = memoizeAsyncValueCache(inMemoryAsyncValueCache<string>('initial'));
 * await memo.load();           // delegates to inner.load() once
 * await memo.load();           // returns memoized value without hitting inner
 * await memo.update('next');   // writes through to inner and refreshes memo
 * ```
 */
export function memoizeAsyncValueCache<T>(inner: AsyncValueCache<T>): AsyncValueCache<T> {
  let loaded: Maybe<{ value: Maybe<T> }>;
  let inFlight: Maybe<Promise<Maybe<T>>>;
  // Bumped on every write/clear so a slow inner.load() resolved after a concurrent
  // update()/clear() can detect that its result is stale and skip clobbering newer state.
  let generation = 0;

  return {
    load: () => {
      if (loaded != null) {
        return Promise.resolve(loaded.value);
      }

      if (inFlight == null) {
        // Cache the in-flight promise so concurrent callers share the same load instead
        // of each firing an independent inner.load(). Cleared on settle so a failed load
        // doesn't permanently poison the memo. The captured generation lets a slow
        // resolve detect a concurrent update()/clear() and skip clobbering newer state.
        const startGen = generation;
        inFlight = inner.load().then(
          (value) => {
            if (generation === startGen) {
              loaded = { value };
              inFlight = undefined;
            }
            return value;
          },
          (error) => {
            if (generation === startGen) {
              inFlight = undefined;
            }
            throw error;
          }
        );
      }

      return inFlight;
    },
    update: async (next) => {
      generation += 1;
      inFlight = undefined;
      // Write through to the inner first; only mutate the memoized snapshot once the inner
      // call succeeds, so a thrown inner.update doesn't leave the memo with a value that
      // never made it to the backing store.
      await inner.update(next);
      loaded = { value: next };
    },
    clear: async () => {
      generation += 1;
      inFlight = undefined;
      await inner.clear();
      loaded = { value: undefined };
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
 *
 * @dbxUtil
 * @dbxUtilCategory cache
 * @dbxUtilTags memoize, memo, cache, async, keyed, record
 * @dbxUtilRelated memoize-async-value-cache
 *
 * @param inner - The backing keyed cache to memoize. The full record is loaded once and cached; writes are forwarded through and applied to the memo.
 * @returns An {@link AsyncKeyedValueCache} that proxies the inner cache with a record-level memoization layer.
 *
 * @example
 * ```ts
 * const memo = memoizeAsyncKeyedValueCache(inMemoryAsyncKeyedValueCache<number>({ a: 1 }));
 * await memo.get('a');           // delegates to inner.load() once
 * await memo.get('a');           // returns memoized entry without hitting inner
 * await memo.set('b', 2);        // writes through to inner and updates memo
 * ```
 */
export function memoizeAsyncKeyedValueCache<T>(inner: AsyncKeyedValueCache<T>): AsyncKeyedValueCache<T> {
  let loaded: Maybe<{ entries: Record<string, T> }>;
  let inFlight: Maybe<Promise<Record<string, T>>>;
  // Bumped on every write/clear so a slow inner.load() resolved after a concurrent
  // set()/remove()/clear() can detect that its result is stale and skip clobbering newer state.
  let generation = 0;

  function ensureLoaded(): Promise<Record<string, T>> {
    if (loaded != null) {
      return Promise.resolve(loaded.entries);
    }

    if (inFlight == null) {
      const startGen = generation;
      inFlight = inner.load().then(
        (entries) => {
          if (generation === startGen) {
            loaded = { entries };
            inFlight = undefined;
          }
          return entries;
        },
        (error) => {
          if (generation === startGen) {
            inFlight = undefined;
          }
          throw error;
        }
      );
    }

    return inFlight;
  }

  return {
    load: async () => ({ ...(await ensureLoaded()) }),
    get: async (key) => (await ensureLoaded())[key],
    set: async (key, value) => {
      const current = await ensureLoaded();
      generation += 1;
      inFlight = undefined;
      // Write through to the inner first so a failed inner.set doesn't leave the memo with
      // an entry that never made it to the backing store.
      await inner.set(key, value);
      loaded = { entries: { ...current, [key]: value } };
    },
    remove: async (key) => {
      const current = await ensureLoaded();
      generation += 1;
      inFlight = undefined;
      await inner.remove(key);
      const next = { ...current };
      delete next[key];
      loaded = { entries: next };
    },
    clear: async () => {
      generation += 1;
      inFlight = undefined;
      await inner.clear();
      loaded = { entries: {} };
    }
  };
}
