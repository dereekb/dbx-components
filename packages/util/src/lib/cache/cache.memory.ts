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
 */
export function inMemoryAsyncKeyedValueCache<T>(initialEntries?: Maybe<Record<string, T>>): AsyncKeyedValueCache<T> {
  let entries: Record<string, T> = { ...(initialEntries ?? {}) };

  return {
    load: async () => ({ ...entries }),
    get: async (key) => entries[key],
    set: async (key, value) => {
      entries = { ...entries, [key]: value };
    },
    remove: async (key) => {
      const next = { ...entries };
      delete next[key];
      entries = next;
    },
    clear: async () => {
      entries = {};
    }
  };
}
