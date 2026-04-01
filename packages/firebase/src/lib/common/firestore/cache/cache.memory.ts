import { Subject, type Observable, filter } from 'rxjs';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type FirestoreCollectionType , type FirestoreModelKey } from '../collection/collection';
import { type FirestoreContextCacheFactory, type FirestoreContextCacheFactoryConfig, type FirestoreCacheEntry, type FirestoreCacheEntryInput, type FirestoreCacheEvent, type FirestoreCollectionCache, type FirestoreCollectionCacheConfig, type FirestoreCollectionCacheInstance, type FirestoreContextCache } from './cache';

/**
 * Default TTL used by the in-memory cache when no TTL is specified.
 *
 * Set to 5 minutes.
 */
export const IN_MEMORY_CACHE_DEFAULT_TTL: Milliseconds = 5 * 60 * 1000;

// MARK: Collection Cache Delegate
/**
 * Delegate that handles actual cache storage for a single collection.
 *
 * Implementations provide the storage mechanism (e.g. in-memory Map, no storage for logging).
 * The shared {@link makeFirestoreCollectionCache} handles TTL checking, event emission,
 * and enabled/disabled state around the delegate.
 *
 * @template T - The document data type
 */
export interface FirestoreCollectionCacheDelegate<T> {
  /**
   * Gets a raw cached entry by key, without TTL or enabled checks.
   */
  get(key: FirestoreModelKey): Maybe<FirestoreCacheEntry<T>>;
  /**
   * Stores a cache entry by key.
   */
  set(key: FirestoreModelKey, entry: FirestoreCacheEntry<T>): void;
  /**
   * Deletes a cache entry by key.
   */
  delete(key: FirestoreModelKey): void;
  /**
   * Clears all entries.
   */
  clear(): void;
}

/**
 * Creates an in-memory {@link FirestoreCollectionCacheDelegate} backed by a Map.
 *
 * @example
 * ```ts
 * const delegate = inMemoryFirestoreCollectionCacheDelegate<UserData>();
 * ```
 */
export function inMemoryFirestoreCollectionCacheDelegate<T>(): FirestoreCollectionCacheDelegate<T> {
  const entries = new Map<FirestoreModelKey, FirestoreCacheEntry<T>>();

  return {
    get: (key) => entries.get(key),
    set: (key, entry) => entries.set(key, entry),
    delete: (key) => {
      entries.delete(key);
    },
    clear: () => entries.clear()
  };
}

/**
 * Creates a no-storage {@link FirestoreCollectionCacheDelegate} that discards all data.
 *
 * Used by {@link readLoggingFirestoreContextCache} where only event emission matters.
 *
 * @example
 * ```ts
 * const delegate = noopFirestoreCollectionCacheDelegate<UserData>();
 * ```
 */
export function noopFirestoreCollectionCacheDelegate<T>(): FirestoreCollectionCacheDelegate<T> {
  return {
    get: () => undefined,
    set: () => {},
    delete: () => {},
    clear: () => {}
  };
}

// MARK: Collection Cache Factory
/**
 * Internal configuration for creating a collection cache via {@link makeFirestoreCollectionCache}.
 */
interface MakeFirestoreCollectionCacheConfig<T> {
  readonly collectionType: FirestoreCollectionType;
  readonly defaultTtl: Milliseconds;
  readonly isEnabled: () => boolean;
  readonly emitEvent: (type: FirestoreCacheEvent['type'], key?: FirestoreModelKey) => void;
  readonly delegate: FirestoreCollectionCacheDelegate<T>;
}

/**
 * Creates a {@link FirestoreCollectionCache} with shared TTL, event, and enabled/disabled logic.
 *
 * The actual storage is handled by the provided {@link FirestoreCollectionCacheDelegate}.
 *
 * @template T - The document data type
 * @param config - Configuration including TTL, enabled check, event emitter, and delegate
 * @returns A collection cache instance
 */
function makeFirestoreCollectionCache<T>(config: MakeFirestoreCollectionCacheConfig<T>): FirestoreCollectionCache<T> {
  const { defaultTtl, isEnabled, emitEvent, delegate } = config;

  function isFresh(entry: FirestoreCacheEntry<T>, maxTtl: Milliseconds): boolean {
    const age = Date.now() - entry.cachedAt.getTime();
    return age < maxTtl;
  }

  const cache: FirestoreCollectionCache<T> = {
    defaultTtl,
    get(key: FirestoreModelKey, maxTtl?: Milliseconds): Maybe<FirestoreCacheEntry<T>> {
      let result: Maybe<FirestoreCacheEntry<T>>;

      if (isEnabled()) {
        const entry = delegate.get(key);
        const effectiveTtl = maxTtl ?? defaultTtl;

        if (entry && isFresh(entry, effectiveTtl)) {
          emitEvent('hit', key);
          result = entry;
        } else {
          if (entry) {
            delegate.delete(key);
          }

          emitEvent('miss', key);
        }
      }

      return result;
    },
    set(key: FirestoreModelKey, input: FirestoreCacheEntryInput<T>): void {
      if (isEnabled()) {
        const entry: FirestoreCacheEntry<T> = {
          key,
          data: input.data,
          cachedAt: new Date()
        };
        delegate.set(key, entry);
        emitEvent('update', key);
      }
    },
    invalidate(key: FirestoreModelKey): void {
      if (isEnabled()) {
        delegate.delete(key);
        emitEvent('invalidate', key);
      }
    },
    clear(): void {
      delegate.clear();
    },
    instance(): FirestoreCollectionCacheInstance<T> {
      return makeFirestoreCollectionCacheInstance<T>(cache);
    },
    destroy(): void {
      delegate.clear();
    }
  };

  return cache;
}

// MARK: Context Cache Factory
/**
 * Configuration for {@link makeFirestoreContextCache}.
 */
export interface MakeFirestoreContextCacheConfig {
  /**
   * Default TTL applied to all collections unless overridden per-collection.
   */
  readonly defaultTtl: Milliseconds;
  /**
   * Creates a delegate for a new collection cache.
   *
   * Called once per collection type when the cache is first requested.
   */
  readonly createDelegate: <T>(collectionType: FirestoreCollectionType) => FirestoreCollectionCacheDelegate<T>;
  /**
   * Optional function that transforms the raw events observable before it is exposed as `events$`.
   *
   * Can be used to filter, map, or augment events. For example, the read-logging cache
   * uses this to filter out 'miss' events since they are expected and not meaningful.
   *
   * When not provided, the raw events observable is used directly.
   */
  readonly mapEvents$?: (events$: Observable<FirestoreCacheEvent>) => Observable<FirestoreCacheEvent>;
}

/**
 * Creates a {@link FirestoreContextCache} with shared event handling, enable/disable controls,
 * and per-type management. The actual cache storage for each collection is handled by
 * delegates created via {@link MakeFirestoreContextCacheConfig.createDelegate}.
 *
 * This is the shared foundation used by both {@link inMemoryFirestoreContextCache} and
 * {@link readLoggingFirestoreContextCache}.
 *
 * @param config - Configuration including default TTL and delegate factory
 * @returns A new context cache
 *
 * @example
 * ```ts
 * const contextCache = makeFirestoreContextCache({
 *   defaultTtl: 60000,
 *   createDelegate: () => inMemoryFirestoreCollectionCacheDelegate()
 * });
 * ```
 */
export function makeFirestoreContextCache(config: MakeFirestoreContextCacheConfig): FirestoreContextCache {
  const { defaultTtl: globalDefaultTtl, createDelegate, mapEvents$ } = config;
  const collectionCaches = new Map<FirestoreCollectionType, FirestoreCollectionCache<unknown>>();
  const disabledTypes = new Set<FirestoreCollectionType>();
  const eventsSubject = new Subject<FirestoreCacheEvent>();

  let globalEnabled = true;

  const rawEvents$ = eventsSubject.asObservable();
  const events$ = mapEvents$ ? mapEvents$(rawEvents$) : rawEvents$;

  function emitEvent(type: FirestoreCacheEvent['type'], collectionType: FirestoreCollectionType, key?: FirestoreModelKey): void {
    eventsSubject.next({
      type,
      collectionType,
      key: key ?? null,
      timestamp: new Date()
    });
  }

  function isEffectivelyEnabled(collectionType: FirestoreCollectionType): boolean {
    return globalEnabled && !disabledTypes.has(collectionType);
  }

  const contextCache: FirestoreContextCache = {
    cacheForCollection<T>(collectionType: FirestoreCollectionType, collectionConfig: FirestoreCollectionCacheConfig): FirestoreCollectionCache<T> {
      let cache = collectionCaches.get(collectionType) as Maybe<FirestoreCollectionCache<T>>;

      if (!cache) {
        cache = makeFirestoreCollectionCache<T>({
          collectionType,
          defaultTtl: collectionConfig.defaultTtl ?? globalDefaultTtl,
          isEnabled: () => isEffectivelyEnabled(collectionType),
          emitEvent: (type, key) => emitEvent(type, collectionType, key),
          delegate: createDelegate<T>(collectionType)
        });
        collectionCaches.set(collectionType, cache as FirestoreCollectionCache<unknown>);
      }

      return cache;
    },
    events$,
    get disabledTypes(): ReadonlySet<FirestoreCollectionType> {
      return disabledTypes;
    },
    isEnabled(): boolean {
      return globalEnabled;
    },
    setEnabled(enabled: boolean): void {
      globalEnabled = enabled;
    },
    clearAll(): void {
      collectionCaches.forEach((cache) => cache.clear());
    },
    isEnabledForType(collectionType: FirestoreCollectionType): boolean {
      return isEffectivelyEnabled(collectionType);
    },
    setEnabledForType(collectionType: FirestoreCollectionType, enabled: boolean): void {
      if (enabled) {
        disabledTypes.delete(collectionType);
      } else {
        disabledTypes.add(collectionType);
      }

      const eventType = enabled ? 'enable_collection' : 'disable_collection';
      emitEvent(eventType, collectionType);
    },
    clearForType(collectionType: FirestoreCollectionType): void {
      const cache = collectionCaches.get(collectionType);

      if (cache) {
        cache.clear();
      }
    },
    destroy(): void {
      eventsSubject.complete();
      collectionCaches.forEach((cache) => cache.destroy());
      collectionCaches.clear();
    }
  };

  return contextCache;
}

// MARK: In-Memory Cache
/**
 * Creates a {@link FirestoreContextCacheFactory} that stores cached documents in memory.
 *
 * Uses simple Map-based storage with TTL-based expiration. Suitable for
 * client-side caching where the application lifecycle matches the cache lifecycle.
 *
 * @returns A factory function that creates in-memory context caches
 *
 * @example
 * ```ts
 * const factory = inMemoryFirestoreContextCacheFactory();
 * const contextCache = factory({ defaultTtl: 60000 });
 * ```
 */
export function inMemoryFirestoreContextCacheFactory(): FirestoreContextCacheFactory {
  return (config?: FirestoreContextCacheFactoryConfig) => inMemoryFirestoreContextCache(config);
}

/**
 * Configuration for creating an in-memory {@link FirestoreContextCache}.
 */
export interface InMemoryFirestoreContextCacheConfig {
  /**
   * Default TTL applied to all collections unless overridden per-collection.
   */
  readonly defaultTtl?: Milliseconds;
}

/**
 * Creates an in-memory {@link FirestoreContextCache} that manages per-collection
 * caches with TTL-based expiration, per-type enable/disable, and event streaming.
 *
 * @param config - Optional configuration
 * @returns A new context cache
 *
 * @example
 * ```ts
 * const contextCache = inMemoryFirestoreContextCache({ defaultTtl: 60000 });
 * const userCache = contextCache.cacheForCollection<UserData>('user', { defaultTtl: 30000 });
 * userCache.set('users/abc', { data: userData });
 * ```
 */
export function inMemoryFirestoreContextCache(config?: InMemoryFirestoreContextCacheConfig): FirestoreContextCache {
  return makeFirestoreContextCache({
    defaultTtl: config?.defaultTtl ?? IN_MEMORY_CACHE_DEFAULT_TTL,
    createDelegate: () => inMemoryFirestoreCollectionCacheDelegate()
  });
}

// MARK: Read-Logging Cache
/**
 * Creates a {@link FirestoreContextCacheFactory} that emits events for all cache interactions
 * but does not actually store any data.
 *
 * Useful for analytics, debugging, and monitoring read patterns without the
 * memory overhead of actual caching.
 *
 * @returns A factory function that creates read-logging context caches
 *
 * @example
 * ```ts
 * const factory = readLoggingFirestoreContextCacheFactory();
 * const contextCache = factory();
 * contextCache.events$.subscribe((event) => console.log(event));
 * ```
 */
export function readLoggingFirestoreContextCacheFactory(): FirestoreContextCacheFactory {
  return (config?: FirestoreContextCacheFactoryConfig) => readLoggingFirestoreContextCache(config);
}

/**
 * Configuration for creating a read-logging {@link FirestoreContextCache}.
 */
export interface ReadLoggingFirestoreContextCacheConfig {
  /**
   * Default TTL applied to all collections. Since no data is stored,
   * this only affects what gets reported as a "miss" vs "hit" (always miss).
   */
  readonly defaultTtl?: Milliseconds;
}

/**
 * Creates a {@link FirestoreContextCache} that emits events for all cache interactions
 * but does not actually store any data. Every `get()` call results in a 'miss' event.
 *
 * Useful for tracking read patterns, debugging, and monitoring which documents
 * are accessed and how often, without the memory overhead of actual caching.
 *
 * @param config - Optional configuration
 * @returns A new read-logging context cache
 *
 * @example
 * ```ts
 * const contextCache = readLoggingFirestoreContextCache();
 * contextCache.events$.subscribe((event) => {
 *   console.log(`${event.type}: ${event.collectionType} ${event.key}`);
 * });
 * ```
 */
export function readLoggingFirestoreContextCache(config?: ReadLoggingFirestoreContextCacheConfig): FirestoreContextCache {
  return makeFirestoreContextCache({
    defaultTtl: config?.defaultTtl ?? IN_MEMORY_CACHE_DEFAULT_TTL,
    createDelegate: () => noopFirestoreCollectionCacheDelegate(),
    mapEvents$: (events$) => events$.pipe(filter((event) => event.type !== 'miss'))
  });
}

// MARK: Cache Instance
/**
 * Creates an operation-scoped {@link FirestoreCollectionCacheInstance} that deduplicates
 * concurrent reads and uses the parent cache as a warm start.
 *
 * @template T - The document data type
 * @param parentCache - The parent collection cache for warm-start lookups
 * @returns An operation-scoped cache instance
 */
function makeFirestoreCollectionCacheInstance<T>(parentCache: FirestoreCollectionCache<T>): FirestoreCollectionCacheInstance<T> {
  const localEntries = new Map<FirestoreModelKey, FirestoreCacheEntry<T>>();
  const inFlight = new Map<FirestoreModelKey, Promise<FirestoreCacheEntry<T>>>();

  const instance: FirestoreCollectionCacheInstance<T> = {
    get(key: FirestoreModelKey, maxTtl?: Milliseconds): Maybe<FirestoreCacheEntry<T>> {
      // Check local instance cache first
      let result: Maybe<FirestoreCacheEntry<T>> = localEntries.get(key);

      // Fall back to parent cache
      if (!result) {
        result = parentCache.get(key, maxTtl);

        if (result) {
          localEntries.set(key, result);
        }
      }

      return result;
    },
    async getOrFetch(key: FirestoreModelKey, fetchFn: () => Promise<FirestoreCacheEntry<T>>): Promise<FirestoreCacheEntry<T>> {
      // Check local cache first
      const cached = localEntries.get(key);

      if (cached) {
        return cached;
      }

      // Check for in-flight request
      const existing = inFlight.get(key);

      if (existing) {
        return existing;
      }

      // Start new fetch
      const fetchPromise = fetchFn().then((entry) => {
        localEntries.set(key, entry);
        parentCache.set(key, entry);
        inFlight.delete(key);
        return entry;
      });

      inFlight.set(key, fetchPromise);
      return fetchPromise;
    }
  };

  return instance;
}
