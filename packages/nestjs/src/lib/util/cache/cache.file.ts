import { type AsyncKeyedValueCache, type AsyncValueCache, type Maybe, memoizeAsyncKeyedValueCache, memoizeAsyncValueCache } from '@dereekb/util';
import { dirname } from 'node:path';
import { readJsonFile, removeFile, writeJsonFile } from '../file/file.json';

/**
 * Default file mode used by the JSON-file caches when none is provided.
 *
 * 0o600 restricts the file to read/write for the owning user only — appropriate for
 * secrets like cached access/refresh tokens.
 */
export const DEFAULT_JSON_FILE_CACHE_MODE = 0o600;

/**
 * Input for {@link createJsonFileAsyncValueCache} and {@link createMemoizedJsonFileAsyncValueCache}.
 */
export interface CreateJsonFileAsyncValueCacheInput<T> {
  /**
   * Absolute path to the JSON file that backs the cache.
   */
  readonly filePath: string;
  /**
   * File mode applied on write. Defaults to {@link DEFAULT_JSON_FILE_CACHE_MODE} (0o600).
   */
  readonly mode?: Maybe<number>;
  /**
   * Optional transform applied to the raw JSON-parsed payload before it is returned from `load()`.
   *
   * Use this to revive types that don't roundtrip through JSON — e.g. a `Date` field stored as an ISO string.
   */
  readonly reviver?: Maybe<(raw: unknown) => Maybe<T>>;
  /**
   * Optional transform applied to the value before it is stringified to JSON on `update()`.
   */
  readonly replacer?: Maybe<(value: T) => unknown>;
}

/**
 * Creates an {@link AsyncValueCache} backed by a single JSON file on disk.
 *
 * Reads always touch disk; wrap with {@link memoizeAsyncValueCache} (or use
 * {@link createMemoizedJsonFileAsyncValueCache}) to add per-process memoization.
 *
 * Multi-process invalidation is not provided. Two processes writing to the same file
 * will last-writer-wins; once memoized, a long-running process will not observe writes
 * from another process.
 *
 * @param input - Configuration bag describing the backing file and optional JSON revive/replace hooks.
 * @param input.filePath - Absolute path to the JSON file that backs the cache.
 * @param input.mode - Optional file mode applied on write; defaults to {@link DEFAULT_JSON_FILE_CACHE_MODE} (0o600).
 * @param input.reviver - Optional transform applied to the raw JSON-parsed payload before it is returned from `load()` (e.g. revive `Date` fields).
 * @param input.replacer - Optional transform applied to the value before it is stringified to JSON on `update()`.
 * @returns An {@link AsyncValueCache} that persists the value to the configured JSON file.
 * @__NO_SIDE_EFFECTS__
 */
export function createJsonFileAsyncValueCache<T>(input: CreateJsonFileAsyncValueCacheInput<T>): AsyncValueCache<T> {
  const { filePath, mode, reviver, replacer } = input;
  const fileMode = mode ?? DEFAULT_JSON_FILE_CACHE_MODE;

  return {
    load: async () => {
      const raw = await readJsonFile<unknown>(filePath);
      let result: Maybe<T>;

      if (raw == null) {
        result = undefined;
      } else {
        result = reviver == null ? (raw as T) : reviver(raw);
      }

      return result;
    },
    update: async (value) => {
      const data = replacer == null ? value : replacer(value);
      await writeJsonFile({
        filePath,
        dirPath: dirname(filePath),
        data,
        mode: fileMode
      });
    },
    clear: async () => {
      await removeFile(filePath);
    }
  };
}

/**
 * Convenience wrapper around {@link createJsonFileAsyncValueCache} composed with
 * {@link memoizeAsyncValueCache}.
 *
 * @param input - Same configuration accepted by {@link createJsonFileAsyncValueCache}; see {@link CreateJsonFileAsyncValueCacheInput}.
 * @returns An {@link AsyncValueCache} backed by the JSON file with a per-process single-load memoization layer in front.
 * @__NO_SIDE_EFFECTS__
 */
export function createMemoizedJsonFileAsyncValueCache<T>(input: CreateJsonFileAsyncValueCacheInput<T>): AsyncValueCache<T> {
  return memoizeAsyncValueCache(createJsonFileAsyncValueCache(input));
}

/**
 * Input for {@link createJsonFileAsyncKeyedValueCache} and {@link createMemoizedJsonFileAsyncKeyedValueCache}.
 */
export interface CreateJsonFileAsyncKeyedValueCacheInput<T> {
  /**
   * Absolute path to the JSON file that backs the cache. The file holds the entire `Record<string, T>`.
   */
  readonly filePath: string;
  /**
   * File mode applied on write. Defaults to {@link DEFAULT_JSON_FILE_CACHE_MODE} (0o600).
   */
  readonly mode?: Maybe<number>;
  /**
   * Optional transform applied to each entry after it is JSON-parsed on `load()`/`get()`.
   */
  readonly reviver?: Maybe<(raw: unknown) => Maybe<T>>;
  /**
   * Optional transform applied to each entry before it is stringified on `set()`.
   */
  readonly replacer?: Maybe<(value: T) => unknown>;
}

/**
 * Creates an {@link AsyncKeyedValueCache} backed by a single JSON file holding a `Record<string, T>`.
 *
 * Reads/writes always touch disk; wrap with {@link memoizeAsyncKeyedValueCache} (or use
 * {@link createMemoizedJsonFileAsyncKeyedValueCache}) to add per-process memoization of the
 * entire record.
 *
 * Multi-process invalidation is not provided; see {@link createJsonFileAsyncValueCache} for caveats.
 *
 * Concurrent `set`/`remove`/`clear` calls are serialized through a per-instance promise chain so
 * the read-modify-write of the entire record file does not race within the same process.
 *
 * @param input - Configuration bag describing the backing file and optional per-entry revive/replace hooks.
 * @param input.filePath - Absolute path to the JSON file that holds the entire `Record<string, T>`.
 * @param input.mode - Optional file mode applied on write; defaults to {@link DEFAULT_JSON_FILE_CACHE_MODE} (0o600).
 * @param input.reviver - Optional transform applied to each entry after it is JSON-parsed on `load()`/`get()`. Returning null/undefined drops the entry.
 * @param input.replacer - Optional transform applied to each entry before it is stringified on `set()`.
 * @returns An {@link AsyncKeyedValueCache} that persists all entries in the configured JSON file.
 * @__NO_SIDE_EFFECTS__
 */
export function createJsonFileAsyncKeyedValueCache<T>(input: CreateJsonFileAsyncKeyedValueCacheInput<T>): AsyncKeyedValueCache<T> {
  const { filePath, mode, reviver, replacer } = input;
  const fileMode = mode ?? DEFAULT_JSON_FILE_CACHE_MODE;

  async function readEntries(): Promise<Record<string, T>> {
    const raw = await readJsonFile<Record<string, unknown>>(filePath);
    let result: Record<string, T>;

    if (raw == null) {
      result = {};
    } else if (reviver == null) {
      result = raw as Record<string, T>;
    } else {
      result = {};
      for (const key of Object.keys(raw)) {
        const revived = reviver(raw[key]);
        if (revived != null) {
          result[key] = revived;
        }
      }
    }

    return result;
  }

  async function writeEntries(entries: Record<string, T>): Promise<void> {
    const data = replacer == null ? entries : Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, replacer(value)]));
    await writeJsonFile({
      filePath,
      dirPath: dirname(filePath),
      data,
      mode: fileMode
    });
  }

  // Serialize set/remove through a per-instance promise chain. Without this, two concurrent
  // mutations would race on the read-modify-write of the entire record file and the second
  // writer's snapshot of the entries would clobber the first.
  let mutationQueue: Promise<unknown> = Promise.resolve();

  function enqueueMutation<T>(fn: () => Promise<T>): Promise<T> {
    const next = mutationQueue.then(fn, fn);
    mutationQueue = next.catch(() => undefined);
    return next;
  }

  return {
    load: readEntries,
    get: async (key) => (await readEntries())[key],
    set: (key, value) =>
      enqueueMutation(async () => {
        const current = await readEntries();
        await writeEntries({ ...current, [key]: value });
      }),
    remove: (key) =>
      enqueueMutation(async () => {
        const current = await readEntries();
        const next = { ...current };
        delete next[key];
        await writeEntries(next);
      }),
    clear: () =>
      enqueueMutation(async () => {
        await removeFile(filePath);
      })
  };
}

/**
 * Convenience wrapper around {@link createJsonFileAsyncKeyedValueCache} composed with
 * {@link memoizeAsyncKeyedValueCache}.
 *
 * @param input - Same configuration accepted by {@link createJsonFileAsyncKeyedValueCache}; see {@link CreateJsonFileAsyncKeyedValueCacheInput}.
 * @returns An {@link AsyncKeyedValueCache} backed by the JSON file with a per-process record-level memoization layer in front.
 * @__NO_SIDE_EFFECTS__
 */
export function createMemoizedJsonFileAsyncKeyedValueCache<T>(input: CreateJsonFileAsyncKeyedValueCacheInput<T>): AsyncKeyedValueCache<T> {
  return memoizeAsyncKeyedValueCache(createJsonFileAsyncKeyedValueCache(input));
}
