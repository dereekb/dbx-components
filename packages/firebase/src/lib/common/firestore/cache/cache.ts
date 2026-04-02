import { EMPTY, type Observable } from 'rxjs';
import { type Destroyable, type Maybe, type Milliseconds } from '@dereekb/util';
import { type FirestoreCollectionType, type FirestoreModelKey } from '../collection/collection';

// MARK: Load Options
/**
 * Options for loading a document with cache support.
 *
 * These options control whether a document read should consult the cache
 * and how stale a cached entry is allowed to be. They are passed to
 * `snapshotData()` (the cache-aware read path) on document instances.
 *
 * @example
 * ```ts
 * const data = await document.snapshotData({ allowCache: true, maxTtl: 60000 });
 * ```
 */
export interface LoadDocumentOptions {
  /**
   * Whether to allow reading from the cache for this read.
   *
   * When true, the accessor checks the collection cache before hitting Firestore.
   * Defaults to false unless the document accessor was created with default cache options enabled.
   */
  readonly allowCache?: boolean;
  /**
   * Maximum TTL to accept for a cached entry on this specific read.
   *
   * Overrides the collection-level TTL. If the cached entry is older than this value,
   * it is treated as a cache miss. Only relevant when allowCache is true.
   */
  readonly maxTtl?: Milliseconds;
}

/**
 * Default cache behavior for a document accessor. When set, all reads through this
 * accessor use the cache unless overridden per-read via {@link LoadDocumentOptions}.
 *
 * @example
 * ```ts
 * const defaults: DocumentAccessorCacheDefaults = { allowCache: true, maxTtl: 300000 };
 * ```
 */
export interface DocumentAccessorCacheDefaults {
  /**
   * When true, reads through this accessor use the cache by default.
   */
  readonly allowCache: boolean;
  /**
   * Default max TTL for cached reads through this accessor.
   */
  readonly maxTtl?: Milliseconds;
}

// MARK: Events
/**
 * Type of cache event emitted by {@link FirestoreContextCache}.
 */
export type FirestoreCacheEventType = 'hit' | 'miss' | 'update' | 'invalidate' | 'enable_collection' | 'disable_collection';

/**
 * Event emitted by {@link FirestoreContextCache.events$} on cache interactions.
 *
 * Provides visibility into cache behavior for analytics, debugging,
 * and monitoring cache effectiveness across all collections.
 */
export interface FirestoreCacheEvent {
  readonly type: FirestoreCacheEventType;
  readonly collectionType: FirestoreCollectionType;
  /**
   * Document key for hit/miss/update/invalidate events.
   * Undefined for enable_collection/disable_collection events.
   */
  readonly key: Maybe<FirestoreModelKey>;
  readonly timestamp: Date;
}

// MARK: Cache Entry
/**
 * A cached entry for a single document, including Firestore metadata timestamps.
 *
 * Only existing documents are cached — `data` is always present (never `Maybe<T>`).
 *
 * @template T - The document data type
 */
export interface FirestoreCacheEntry<T> {
  readonly key: FirestoreModelKey;
  readonly data: T;
  readonly cachedAt: Date;
}

/**
 * Input for setting a cache entry. Extracted from a DocumentSnapshot.
 *
 * @template T - The document data type
 */
export interface FirestoreCacheEntryInput<T> {
  readonly data: T;
}

// MARK: Collection Cache
/**
 * Cache for a single Firestore collection. Entries are keyed by document path.
 *
 * Each collection gets its own cache instance managed by {@link FirestoreContextCache}.
 * The cache supports TTL-based expiration, passive population from reads/writes,
 * and operation-scoped instances for deduplication.
 *
 * @template T - The document data type
 */
export interface FirestoreCollectionCache<T = unknown> extends Destroyable {
  /**
   * Gets a cached entry if it exists and is within the TTL.
   *
   * @param key - The document path
   * @param maxTtl - Optional TTL override; defaults to the collection's defaultTtl
   * @returns The cached entry, or undefined if not found or expired
   */
  get(key: FirestoreModelKey, maxTtl?: Milliseconds): Maybe<FirestoreCacheEntry<T>>;
  /**
   * Sets or updates a cache entry. Called passively on every read/write.
   *
   * @param key - The document path
   * @param entry - The data to cache
   */
  set(key: FirestoreModelKey, entry: FirestoreCacheEntryInput<T>): void;
  /**
   * Invalidates a specific cache entry.
   *
   * @param key - The document path to invalidate
   */
  invalidate(key: FirestoreModelKey): void;
  /**
   * Clears all entries in this collection cache.
   */
  clear(): void;
  /**
   * Creates a short-lived in-memory cache instance scoped to a single operation.
   *
   * Deduplicates reads within a batch operation — equivalent to what
   * `LimitedFirestoreDocumentAccessorSnapshotCache` does today, but backed
   * by this cache's existing entries as a warm start.
   */
  instance(): FirestoreCollectionCacheInstance<T>;
  /**
   * The default TTL for this collection cache.
   */
  readonly defaultTtl: Milliseconds;
}

/**
 * Short-lived, operation-scoped cache instance. Wraps the parent
 * {@link FirestoreCollectionCache} and adds Promise-level deduplication for
 * concurrent in-flight reads within the same operation.
 *
 * Replaces the existing `LimitedFirestoreDocumentAccessorSnapshotCache` pattern.
 *
 * @template T - The document data type
 */
export interface FirestoreCollectionCacheInstance<T = unknown> {
  /**
   * Gets a cached entry, checking the instance's local cache first,
   * then the parent {@link FirestoreCollectionCache}.
   *
   * @param key - The document path
   * @param maxTtl - Optional TTL override
   * @returns The cached entry, or undefined if not found or expired
   */
  get(key: FirestoreModelKey, maxTtl?: Milliseconds): Maybe<FirestoreCacheEntry<T>>;
  /**
   * Gets or fetches a document, deduplicating concurrent requests for the same key.
   * If a fetch for this key is already in-flight, returns the same Promise.
   *
   * @param key - The document path
   * @param fetchFn - Function that fetches the document from Firestore
   * @returns The cached or freshly-fetched entry
   */
  getOrFetch(key: FirestoreModelKey, fetchFn: () => Promise<FirestoreCacheEntry<T>>): Promise<FirestoreCacheEntry<T>>;
}

// MARK: Collection Cache Config
/**
 * Configuration for a cacheable collection.
 */
export interface FirestoreCollectionCacheConfig {
  /**
   * Default TTL for cached entries in this collection.
   */
  readonly defaultTtl: Milliseconds;
}

// MARK: Context Cache
/**
 * Factory and manager for per-collection caches. Lives on {@link FirestoreContext}.
 *
 * Provides global and per-type controls for enabling/disabling caching and
 * resetting cached data. Uses {@link FirestoreCollectionType} for keying.
 */
export interface FirestoreContextCache extends Destroyable {
  /**
   * Gets or creates a cache for the given collection.
   *
   * @param collectionType - The unique collection type identifier
   * @param config - TTL configuration for this collection
   * @returns A cache instance for the collection
   */
  cacheForCollection<T>(collectionType: FirestoreCollectionType, config: FirestoreCollectionCacheConfig): FirestoreCollectionCache<T>;
  /**
   * Observable stream of cache events (hits, misses, updates) across all collections.
   *
   * Useful for analytics, debugging, and monitoring cache effectiveness.
   */
  readonly events$: Observable<FirestoreCacheEvent>;

  /**
   * Set of model types that have caching explicitly disabled.
   *
   * Caching is enabled by default for all types. Only types added here are excluded.
   */
  readonly disabledTypes: ReadonlySet<FirestoreCollectionType>;

  // --- Global controls ---

  /**
   * Whether caching is globally enabled. Defaults to true. When false, all
   * collection caches behave as noops regardless of their individual configuration.
   */
  isEnabled(): boolean;
  /**
   * Enables or disables caching globally.
   *
   * @param enabled - Whether to enable caching
   */
  setEnabled(enabled: boolean): void;
  /**
   * Clears all cached entries across all collections.
   */
  clearAll(): void;

  // --- Per-type controls ---

  /**
   * Whether caching is enabled for a specific model type/identity.
   *
   * Returns false if the type is explicitly disabled or if caching is globally disabled.
   *
   * @param collectionType - The collection type to check
   * @returns Whether caching is active for this type
   */
  isEnabledForType(collectionType: FirestoreCollectionType): boolean;
  /**
   * Enables or disables caching for a specific model type/identity.
   *
   * When disabled, the collection cache for that type behaves as a noop.
   * When re-enabled, the cache resumes normal operation.
   *
   * @param collectionType - The collection type to toggle
   * @param enabled - Whether to enable caching for this type
   */
  setEnabledForType(collectionType: FirestoreCollectionType, enabled: boolean): void;
  /**
   * Clears all cached entries for a specific model type/identity.
   *
   * @param collectionType - The collection type to clear
   */
  clearForType(collectionType: FirestoreCollectionType): void;
}

// MARK: Document Cache
/**
 * Cache bound to a specific document. Wraps a {@link FirestoreCollectionCache}
 * with the document's key pre-applied, so callers don't need to pass the key.
 *
 * Returned by {@link LimitedFirestoreDocumentAccessor.cacheForDocument}.
 *
 * @template T - The document data type
 */
export interface FirestoreCollectionDocumentCache<T = unknown> {
  /**
   * Gets the cached entry for this document if it exists and is within the TTL.
   *
   * @param maxTtl - Optional TTL override; defaults to the collection's defaultTtl
   * @returns The cached entry, or undefined if not found or expired
   */
  get(maxTtl?: Milliseconds): Maybe<FirestoreCacheEntry<T>>;
  /**
   * Sets or updates the cache entry for this document.
   *
   * @param entry - The data to cache
   */
  set(entry: FirestoreCacheEntryInput<T>): void;
  /**
   * Invalidates the cache entry for this document.
   */
  invalidate(): void;
}

/**
 * Creates a {@link FirestoreCollectionDocumentCache} that delegates to the given
 * collection cache with the key pre-bound.
 *
 * @param collectionCache - The parent collection cache
 * @param key - The document path to bind
 * @returns A document-scoped cache
 *
 * @example
 * ```ts
 * const docCache = firestoreCollectionDocumentCache(collectionCache, 'users/abc');
 * docCache.set({ data: userData });
 * const entry = docCache.get();
 * ```
 */
export function firestoreCollectionDocumentCache<T>(collectionCache: FirestoreCollectionCache<T>, key: FirestoreModelKey): FirestoreCollectionDocumentCache<T> {
  return {
    get: (maxTtl?: Milliseconds) => collectionCache.get(key, maxTtl),
    set: (entry: FirestoreCacheEntryInput<T>) => collectionCache.set(key, entry),
    invalidate: () => collectionCache.invalidate(key)
  };
}

/**
 * Singleton noop {@link FirestoreCollectionDocumentCache} that discards all operations.
 */
const NOOP_FIRESTORE_COLLECTION_DOCUMENT_CACHE: FirestoreCollectionDocumentCache<any> = {
  get: () => undefined,
  set: () => {
    // noop
  },
  invalidate: () => {
    // noop
  }
};

/**
 * Returns the singleton noop {@link FirestoreCollectionDocumentCache}.
 *
 * @returns A noop document cache that discards all operations.
 */
export function noopFirestoreCollectionDocumentCache<T>(): FirestoreCollectionDocumentCache<T> {
  return NOOP_FIRESTORE_COLLECTION_DOCUMENT_CACHE as FirestoreCollectionDocumentCache<T>;
}

// MARK: Refs
/**
 * Reference to a {@link FirestoreCollectionCache} instance.
 *
 * @template T - The document data type
 */
export interface FirestoreCollectionCacheRef<T = unknown> {
  readonly cache: FirestoreCollectionCache<T>;
}

/**
 * Reference to a {@link FirestoreContextCache} instance.
 *
 * The cache is always defined — when no cache factory is configured,
 * a noop implementation is used.
 */
export interface FirestoreContextCacheRef {
  readonly cache: FirestoreContextCache;
}

// MARK: Context Cache Factory
/**
 * Factory function that creates a {@link FirestoreContextCache}.
 *
 * Provided at the app level (Angular providers / NestJS modules) via
 * {@link FirestoreContextFactoryParams}. Each platform can use its own
 * implementation — e.g. {@link inMemoryFirestoreContextCacheFactory} for
 * in-memory TTL-based caching.
 *
 * @example
 * ```ts
 * const factory: FirestoreContextCacheFactory = (config) => inMemoryFirestoreContextCache(config);
 * ```
 */
export type FirestoreContextCacheFactory = (config?: FirestoreContextCacheFactoryConfig) => FirestoreContextCache;

/**
 * Configuration passed to a {@link FirestoreContextCacheFactory} when creating the cache.
 */
export interface FirestoreContextCacheFactoryConfig {
  /**
   * Default TTL for all collections unless overridden per-collection.
   */
  readonly defaultTtl?: Milliseconds;
}

/**
 * Reference to an optional {@link FirestoreContextCacheFactory}.
 */
export interface FirestoreContextCacheFactoryRef {
  readonly firestoreContextCacheFactory?: Maybe<FirestoreContextCacheFactory>;
}

// MARK: Noop
/**
 * Singleton noop {@link FirestoreCollectionCacheInstance} that discards all operations.
 */
const NOOP_FIRESTORE_COLLECTION_CACHE_INSTANCE: FirestoreCollectionCacheInstance<any> = {
  get: () => undefined,
  getOrFetch: (_key, fetchFn) => fetchFn()
};

/**
 * Singleton noop {@link FirestoreCollectionCache} that discards all operations.
 *
 * Used when no cache driver is configured so that `.cache` is always defined,
 * avoiding optional checks throughout the codebase.
 */
const NOOP_FIRESTORE_COLLECTION_CACHE: FirestoreCollectionCache<any> = {
  defaultTtl: 0,
  get: () => undefined,
  set: () => {
    // noop
  },
  invalidate: () => {
    // noop
  },
  clear: () => {
    // noop
  },
  instance: () => NOOP_FIRESTORE_COLLECTION_CACHE_INSTANCE,
  destroy: () => {
    // noop
  }
};

/**
 * Returns the singleton noop {@link FirestoreCollectionCache} that discards all operations.
 *
 * Used when no cache driver is configured so that `.cache` is always defined.
 *
 * @example
 * ```ts
 * const cache = noopFirestoreCollectionCache();
 * cache.get('path/to/doc'); // always returns undefined
 * cache.set('path/to/doc', { data }); // no-op
 * ```
 *
 * @returns The singleton noop collection cache.
 */
export function noopFirestoreCollectionCache<T>(): FirestoreCollectionCache<T> {
  return NOOP_FIRESTORE_COLLECTION_CACHE as FirestoreCollectionCache<T>;
}

/**
 * Singleton noop {@link FirestoreContextCache} that always returns noop collection caches.
 *
 * Used when no cache factory is configured so that `FirestoreContext.cache` is always defined.
 */
const NOOP_FIRESTORE_CONTEXT_CACHE: FirestoreContextCache = {
  cacheForCollection: <T>() => noopFirestoreCollectionCache<T>(),
  events$: EMPTY,
  disabledTypes: new Set(),
  isEnabled: () => false,
  setEnabled: () => {
    // noop
  },
  clearAll: () => {
    // noop
  },
  isEnabledForType: () => false,
  setEnabledForType: () => {
    // noop
  },
  clearForType: () => {
    // noop
  },
  destroy: () => {
    // noop
  }
};

/**
 * Returns the singleton noop {@link FirestoreContextCache}.
 *
 * Used when no cache factory is configured so that `FirestoreContext.cache` is always defined,
 * avoiding null checks throughout the codebase.
 *
 * @example
 * ```ts
 * const cache = noopFirestoreContextCache();
 * cache.cacheForCollection('user', { defaultTtl: 0 }); // returns noop collection cache
 * cache.isEnabled(); // false
 * ```
 *
 * @returns The singleton noop context cache.
 */
export function noopFirestoreContextCache(): FirestoreContextCache {
  return NOOP_FIRESTORE_CONTEXT_CACHE;
}
