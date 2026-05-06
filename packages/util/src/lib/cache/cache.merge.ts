import { type AsyncKeyedValueCache, type AsyncValueCache } from './cache';

/**
 * Composes multiple {@link AsyncValueCache} instances into a single read-from-first-write-to-all cache.
 *
 * - {@link AsyncValueCache.load} returns the first non-null/undefined value from the input caches in order.
 * - {@link AsyncValueCache.update} writes the value to every input cache, propagating from the
 *   lowest-precedence (slowest, source-of-truth) tier up to the highest-precedence (fastest) tier
 *   so a failed write to the backing store is not masked by a successful write to memory.
 * - {@link AsyncValueCache.clear} clears every input cache in the same lower-to-higher order.
 *
 * Useful for memory-then-disk layering or for combining a fast tier with a slow source-of-truth tier.
 */
export function mergeAsyncValueCaches<T>(caches: ReadonlyArray<AsyncValueCache<T>>): AsyncValueCache<T> {
  return {
    load: async () => {
      let result: T | null | undefined;

      for (const cache of caches) {
        const value = await cache.load();
        if (value != null) {
          result = value;
          break;
        }
      }

      return result;
    },
    update: async (value) => {
      for (let i = caches.length - 1; i >= 0; i -= 1) {
        await caches[i].update(value);
      }
    },
    clear: async () => {
      for (let i = caches.length - 1; i >= 0; i -= 1) {
        await caches[i].clear();
      }
    }
  };
}

/**
 * Composes multiple {@link AsyncKeyedValueCache} instances into a single read-from-first-write-to-all cache.
 *
 * - {@link AsyncKeyedValueCache.get} returns the first non-null/undefined value from the input caches in order for a given key.
 * - {@link AsyncKeyedValueCache.load} returns a merged record where earlier caches' entries take precedence over later caches'.
 * - Writes ({@link AsyncKeyedValueCache.set} / {@link AsyncKeyedValueCache.remove}) propagate to every input cache.
 * - {@link AsyncKeyedValueCache.clear} clears every input cache.
 */
export function mergeAsyncKeyedValueCaches<T>(caches: ReadonlyArray<AsyncKeyedValueCache<T>>): AsyncKeyedValueCache<T> {
  return {
    load: async () => {
      // Use a null-prototype object so a key like "__proto__" loaded from any cache cannot
      // mutate the prototype chain via Object.assign.
      const merged = Object.create(null) as Record<string, T>;

      for (let i = caches.length - 1; i >= 0; i -= 1) {
        const entries = await caches[i].load();
        Object.assign(merged, entries);
      }

      return merged;
    },
    get: async (key) => {
      let result: T | null | undefined;

      for (const cache of caches) {
        const value = await cache.get(key);
        if (value != null) {
          result = value;
          break;
        }
      }

      return result;
    },
    set: async (key, value) => {
      for (let i = caches.length - 1; i >= 0; i -= 1) {
        await caches[i].set(key, value);
      }
    },
    remove: async (key) => {
      for (let i = caches.length - 1; i >= 0; i -= 1) {
        await caches[i].remove(key);
      }
    },
    clear: async () => {
      for (let i = caches.length - 1; i >= 0; i -= 1) {
        await caches[i].clear();
      }
    }
  };
}
