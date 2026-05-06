import { type Maybe } from '../value/maybe.type';
import { type AsyncKeyedValueCache, type AsyncValueCache } from './cache';

/**
 * Creates an in-memory {@link AsyncValueCache} backed by a single closure-scoped variable.
 *
 * Useful as the inner of {@link memoizeAsyncValueCache} and as a stand-in for tests.
 */
export function inMemoryAsyncValueCache<T>(initialValue?: Maybe<T>): AsyncValueCache<T> {
  let value: Maybe<T> = initialValue ?? undefined;

  return {
    load: async () => value,
    update: async (next) => {
      value = next;
    },
    clear: async () => {
      value = undefined;
    }
  };
}

/**
 * Creates an in-memory {@link AsyncKeyedValueCache} backed by a closure-scoped record.
 *
 * Useful as the inner of {@link memoizeAsyncKeyedValueCache} and as a stand-in for tests.
 *
 * Backed by a null-prototype object so inherited properties (`toString`, `hasOwnProperty`, etc.)
 * are never returned from `get` and `__proto__` keys cannot mutate the prototype chain.
 */
export function inMemoryAsyncKeyedValueCache<T>(initialEntries?: Maybe<Record<string, T>>): AsyncKeyedValueCache<T> {
  let entries: Record<string, T> = Object.assign(Object.create(null) as Record<string, T>, initialEntries ?? {});

  return {
    load: async () => Object.assign(Object.create(null) as Record<string, T>, entries),
    get: async (key) => (Object.hasOwn(entries, key) ? entries[key] : undefined),
    set: async (key, value) => {
      const next = Object.assign(Object.create(null) as Record<string, T>, entries);
      next[key] = value;
      entries = next;
    },
    remove: async (key) => {
      const next = Object.assign(Object.create(null) as Record<string, T>, entries);
      delete next[key];
      entries = next;
    },
    clear: async () => {
      entries = Object.create(null) as Record<string, T>;
    }
  };
}
