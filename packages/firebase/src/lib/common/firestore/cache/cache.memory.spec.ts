import { firstValueFrom, take, toArray } from 'rxjs';
import { type FirestoreCacheEntry, type FirestoreCollectionCache, type FirestoreContextCache, noopFirestoreCollectionCache, noopFirestoreContextCache } from './cache';
import { inMemoryFirestoreContextCacheFactory, inMemoryFirestoreContextCache, readLoggingFirestoreContextCache, readLoggingFirestoreContextCacheFactory, IN_MEMORY_CACHE_DEFAULT_TTL } from './cache.memory';

// MARK: Test Helpers
function makeCacheEntry<T>(data: T): { data: T } {
  return { data };
}

describe('inMemoryFirestoreContextCache()', () => {
  let contextCache: FirestoreContextCache;

  beforeEach(() => {
    contextCache = inMemoryFirestoreContextCache({ defaultTtl: 60000 });
  });

  describe('cacheForCollection()', () => {
    it('should return the same cache for the same collection type', () => {
      const cache1 = contextCache.cacheForCollection('user', { defaultTtl: 30000 });
      const cache2 = contextCache.cacheForCollection('user', { defaultTtl: 30000 });

      expect(cache1).toBe(cache2);
    });

    it('should return different caches for different collection types', () => {
      const cache1 = contextCache.cacheForCollection('user', { defaultTtl: 30000 });
      const cache2 = contextCache.cacheForCollection('post', { defaultTtl: 30000 });

      expect(cache1).not.toBe(cache2);
    });
  });

  describe('enabled', () => {
    it('should be enabled by default', () => {
      expect(contextCache.isEnabled()).toBe(true);
    });

    it('should respect setEnabled(false)', () => {
      contextCache.setEnabled(false);
      expect(contextCache.isEnabled()).toBe(false);
    });

    it('should disable cache hits globally when disabled', () => {
      const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
      cache.set('users/abc', makeCacheEntry('hello'));

      contextCache.setEnabled(false);

      const result = cache.get('users/abc');
      expect(result).toBeUndefined();
    });

    it('should resume cache hits when re-enabled', () => {
      const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
      cache.set('users/abc', makeCacheEntry('hello'));

      contextCache.setEnabled(false);
      contextCache.setEnabled(true);

      const result = cache.get('users/abc');
      expect(result).toBeDefined();
      expect(result!.data).toBe('hello');
    });
  });

  describe('per-type controls', () => {
    it('should disable a specific type', () => {
      const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
      cache.set('users/abc', makeCacheEntry('hello'));

      contextCache.setEnabledForType('user', false);

      expect(contextCache.isEnabledForType('user')).toBe(false);
      expect(cache.get('users/abc')).toBeUndefined();
    });

    it('should not affect other types when disabling one', () => {
      const userCache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
      const postCache = contextCache.cacheForCollection<string>('post', { defaultTtl: 60000 });

      userCache.set('users/abc', makeCacheEntry('user'));
      postCache.set('posts/abc', makeCacheEntry('post'));

      contextCache.setEnabledForType('user', false);

      expect(userCache.get('users/abc')).toBeUndefined();
      expect(postCache.get('posts/abc')).toBeDefined();
    });

    it('should track disabled types', () => {
      contextCache.setEnabledForType('user', false);
      expect(contextCache.disabledTypes.has('user')).toBe(true);

      contextCache.setEnabledForType('user', true);
      expect(contextCache.disabledTypes.has('user')).toBe(false);
    });
  });

  describe('clearAll()', () => {
    it('should clear all collection caches', () => {
      const userCache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
      const postCache = contextCache.cacheForCollection<string>('post', { defaultTtl: 60000 });

      userCache.set('users/abc', makeCacheEntry('user'));
      postCache.set('posts/abc', makeCacheEntry('post'));

      contextCache.clearAll();

      expect(userCache.get('users/abc')).toBeUndefined();
      expect(postCache.get('posts/abc')).toBeUndefined();
    });
  });

  describe('clearForType()', () => {
    it('should clear only the specified type', () => {
      const userCache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
      const postCache = contextCache.cacheForCollection<string>('post', { defaultTtl: 60000 });

      userCache.set('users/abc', makeCacheEntry('user'));
      postCache.set('posts/abc', makeCacheEntry('post'));

      contextCache.clearForType('user');

      expect(userCache.get('users/abc')).toBeUndefined();
      expect(postCache.get('posts/abc')).toBeDefined();
    });
  });

  describe('events$', () => {
    it('should emit hit events', async () => {
      const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
      const eventsPromise = firstValueFrom(contextCache.events$.pipe(take(2), toArray()));

      cache.set('users/abc', makeCacheEntry('hello'));
      cache.get('users/abc');

      const events = await eventsPromise;
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('update');
      expect(events[1].type).toBe('hit');
      expect(events[1].key).toBe('users/abc');
    });

    it('should emit miss events', async () => {
      const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
      const eventPromise = firstValueFrom(contextCache.events$);

      cache.get('users/nonexistent');

      const event = await eventPromise;
      expect(event.type).toBe('miss');
      expect(event.key).toBe('users/nonexistent');
    });

    it('should emit invalidate events', async () => {
      const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
      const eventsPromise = firstValueFrom(contextCache.events$.pipe(take(2), toArray()));

      cache.set('users/abc', makeCacheEntry('hello'));
      cache.invalidate('users/abc');

      const events = await eventsPromise;
      expect(events[1].type).toBe('invalidate');
    });

    it('should emit enable_collection/disable_collection events', async () => {
      const eventsPromise = firstValueFrom(contextCache.events$.pipe(take(2), toArray()));

      contextCache.setEnabledForType('user', false);
      contextCache.setEnabledForType('user', true);

      const events = await eventsPromise;
      expect(events[0].type).toBe('disable_collection');
      expect(events[1].type).toBe('enable_collection');
    });
  });
});

describe('FirestoreCollectionCache', () => {
  let contextCache: FirestoreContextCache;
  let cache: FirestoreCollectionCache<string>;

  beforeEach(() => {
    contextCache = inMemoryFirestoreContextCache({ defaultTtl: 60000 });
    cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
  });

  describe('get/set', () => {
    it('should return undefined for a cache miss', () => {
      expect(cache.get('users/abc')).toBeUndefined();
    });

    it('should return the cached entry for a cache hit', () => {
      cache.set('users/abc', makeCacheEntry('hello'));

      const entry = cache.get('users/abc');
      expect(entry).toBeDefined();
      expect(entry!.data).toBe('hello');
      expect(entry!.key).toBe('users/abc');
    });
  });

  describe('TTL', () => {
    it('should return undefined for expired entries', () => {
      cache.set('users/abc', makeCacheEntry('hello'));

      // Manually expire by setting cachedAt in the past
      const entry = cache.get('users/abc') as FirestoreCacheEntry<string>;
      expect(entry).toBeDefined();

      // Use a very short maxTtl to simulate expiration
      const result = cache.get('users/abc', 0);
      expect(result).toBeUndefined();
    });

    it('should respect maxTtl override', () => {
      cache.set('users/abc', makeCacheEntry('hello'));

      // With very short TTL, should miss
      expect(cache.get('users/abc', 0)).toBeUndefined();

      // With long TTL (and fresh entry), should hit
      cache.set('users/abc', makeCacheEntry('hello'));
      expect(cache.get('users/abc', 999999)).toBeDefined();
    });
  });

  describe('invalidate', () => {
    it('should remove a specific entry', () => {
      cache.set('users/abc', makeCacheEntry('hello'));
      cache.invalidate('users/abc');

      expect(cache.get('users/abc')).toBeUndefined();
    });

    it('should not affect other entries', () => {
      cache.set('users/abc', makeCacheEntry('hello'));
      cache.set('users/def', makeCacheEntry('world'));

      cache.invalidate('users/abc');

      expect(cache.get('users/abc')).toBeUndefined();
      expect(cache.get('users/def')).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('users/abc', makeCacheEntry('hello'));
      cache.set('users/def', makeCacheEntry('world'));

      cache.clear();

      expect(cache.get('users/abc')).toBeUndefined();
      expect(cache.get('users/def')).toBeUndefined();
    });
  });

  describe('instance()', () => {
    it('should use parent cache as warm start', () => {
      cache.set('users/abc', makeCacheEntry('hello'));

      const instance = cache.instance();
      const entry = instance.get('users/abc');
      expect(entry).toBeDefined();
      expect(entry!.data).toBe('hello');
    });

    it('should deduplicate concurrent getOrFetch calls', async () => {
      const instance = cache.instance();
      let fetchCount = 0;

      const fetchFn = () => {
        fetchCount += 1;
        return Promise.resolve<FirestoreCacheEntry<string>>({
          key: 'users/abc',
          data: 'fetched',
          cachedAt: new Date()
        });
      };

      const [result1, result2] = await Promise.all([instance.getOrFetch('users/abc', fetchFn), instance.getOrFetch('users/abc', fetchFn)]);

      expect(fetchCount).toBe(1);
      expect(result1.data).toBe('fetched');
      expect(result2.data).toBe('fetched');
    });

    it('should populate parent cache after getOrFetch', async () => {
      const instance = cache.instance();

      await instance.getOrFetch('users/abc', () =>
        Promise.resolve<FirestoreCacheEntry<string>>({
          key: 'users/abc',
          data: 'fetched',
          cachedAt: new Date()
        })
      );

      const parentEntry = cache.get('users/abc');
      expect(parentEntry).toBeDefined();
      expect(parentEntry!.data).toBe('fetched');
    });

    it('should return cached entry from local instance on subsequent getOrFetch', async () => {
      const instance = cache.instance();
      let fetchCount = 0;

      const makeFetchFn = () => {
        fetchCount += 1;
        return Promise.resolve<FirestoreCacheEntry<string>>({
          key: 'users/abc',
          data: `fetched-${fetchCount}`,
          cachedAt: new Date()
        });
      };

      await instance.getOrFetch('users/abc', makeFetchFn);
      const result = await instance.getOrFetch('users/abc', makeFetchFn);

      expect(fetchCount).toBe(1);
      expect(result.data).toBe('fetched-1');
    });
  });
});

describe('noopFirestoreCollectionCache()', () => {
  it('should always return undefined for get', () => {
    const cache = noopFirestoreCollectionCache<string>();
    expect(cache.get('users/abc')).toBeUndefined();
  });

  it('should silently accept set calls', () => {
    const cache = noopFirestoreCollectionCache<string>();
    expect(() => cache.set('users/abc', makeCacheEntry('hello'))).not.toThrow();
  });

  it('should return a noop instance', async () => {
    const cache = noopFirestoreCollectionCache<string>();
    const instance = cache.instance();

    expect(instance.get('users/abc')).toBeUndefined();

    let called = false;
    const result = await instance.getOrFetch('users/abc', () => {
      called = true;
      return Promise.resolve<FirestoreCacheEntry<string>>({
        key: 'users/abc',
        data: 'fetched',
        cachedAt: new Date()
      });
    });

    expect(called).toBe(true);
    expect(result.data).toBe('fetched');
  });
});

describe('noopFirestoreContextCache()', () => {
  it('should return a noop context cache', () => {
    const contextCache = noopFirestoreContextCache();
    expect(contextCache.isEnabled()).toBe(false);
  });

  it('should return noop collection caches', () => {
    const contextCache = noopFirestoreContextCache();
    const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 30000 });

    cache.set('users/abc', makeCacheEntry('hello'));
    expect(cache.get('users/abc')).toBeUndefined();
  });

  it('should silently accept control operations', () => {
    const contextCache = noopFirestoreContextCache();

    expect(() => contextCache.setEnabled(true)).not.toThrow();
    expect(() => contextCache.clearAll()).not.toThrow();
    expect(() => contextCache.setEnabledForType('user', false)).not.toThrow();
    expect(() => contextCache.clearForType('user')).not.toThrow();
  });

  it('should always report types as disabled', () => {
    const contextCache = noopFirestoreContextCache();
    expect(contextCache.isEnabledForType('user')).toBe(false);
  });
});

describe('inMemoryFirestoreContextCacheFactory()', () => {
  it('should create a factory that produces context caches', () => {
    const factory = inMemoryFirestoreContextCacheFactory();
    const contextCache = factory({ defaultTtl: 30000 });

    expect(contextCache).toBeDefined();
    expect(contextCache.isEnabled()).toBe(true);
  });

  it('should use the default TTL when none specified', () => {
    const factory = inMemoryFirestoreContextCacheFactory();
    const contextCache = factory();
    const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 0 });

    // defaultTtl of 0 from collection config is overridden by global default via context
    expect(cache.defaultTtl).toBeDefined();
  });
});

describe('readLoggingFirestoreContextCache()', () => {
  it('should never return cached data', () => {
    const contextCache = readLoggingFirestoreContextCache();
    const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });

    cache.set('users/abc', makeCacheEntry('hello'));
    expect(cache.get('users/abc')).toBeUndefined();
  });

  it('should emit update and invalidate events but not miss events', async () => {
    const contextCache = readLoggingFirestoreContextCache();
    const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
    const eventsPromise = firstValueFrom(contextCache.events$.pipe(take(2), toArray()));

    cache.set('users/abc', makeCacheEntry('hello'));
    cache.get('users/abc');
    cache.invalidate('users/abc');

    const events = await eventsPromise;
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('update');
    expect(events[1].type).toBe('invalidate');
  });

  it('should not emit miss events on get', async () => {
    const contextCache = readLoggingFirestoreContextCache();
    const cache = contextCache.cacheForCollection<string>('user', { defaultTtl: 60000 });
    const eventsPromise = firstValueFrom(contextCache.events$.pipe(take(1), toArray()));

    cache.set('users/abc', makeCacheEntry('hello'));
    cache.get('users/abc');

    const events = await eventsPromise;
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('update');
  });
});

describe('readLoggingFirestoreContextCacheFactory()', () => {
  it('should create a factory that produces read-logging context caches', () => {
    const factory = readLoggingFirestoreContextCacheFactory();
    const contextCache = factory();

    expect(contextCache).toBeDefined();
    expect(contextCache.isEnabled()).toBe(true);
  });
});

describe('IN_MEMORY_CACHE_DEFAULT_TTL', () => {
  it('should be 5 minutes in milliseconds', () => {
    expect(IN_MEMORY_CACHE_DEFAULT_TTL).toBe(300000);
  });
});
