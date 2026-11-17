import { type AsyncValueCache, type Maybe, filterMaybeArrayValues, inMemoryAsyncKeyedValueCache, isExpired, mergeAsyncValueCaches } from '@dereekb/util';
import { type ZohoAccessToken, type ZohoAccessTokenCache, type ZohoServiceAccessTokenKey } from './accounts';

export type ZohoAccountsAccessTokenCacheRecord = Record<ZohoServiceAccessTokenKey, Maybe<ZohoAccessToken>>;

/**
 * Service used for retrieving ZohoAccessTokenCache for Zoho services.
 *
 * Framework-agnostic: this abstract class carries no decorators, so it can be used outside of NestJS. The
 * `@dereekb/zoho/nestjs` entry re-exports this same class object, which NestJS apps use as the injection token.
 */
export abstract class ZohoAccountsAccessTokenCacheService {
  /**
   * Loads an ZohoAccessTokenCache for the given service key.
   *
   * @param service
   */
  abstract loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache;
}

function buildZohoReadAdapter(cache: ZohoAccessTokenCache): AsyncValueCache<ZohoAccessToken> {
  return {
    load: async () => {
      const value = await cache.loadCachedToken().catch(() => undefined);
      return value != null && !isExpired(value) ? value : undefined;
    },
    update: (token) => cache.updateCachedToken(token),
    clear: () => cache.clearCachedToken()
  };
}

function updateZohoCacheCapturingError(cache: ZohoAccessTokenCache, accessToken: ZohoAccessToken): Promise<Maybe<readonly [ZohoAccessTokenCache, unknown]>> {
  return cache
    .updateCachedToken(accessToken)
    .then(() => null)
    .catch((e) => [cache, e] as const);
}

export type LogMergeZohoAccountsAccessTokenCacheServiceErrorFunction = (failedUpdates: (readonly [ZohoAccessTokenCache, unknown])[]) => void;

/**
 * Default error logging function for merged Zoho access token cache services.
 *
 * @param failedUpdates - Array of cache/error tuples that failed during update.
 */
export function logMergeZohoAccountsAccessTokenCacheServiceErrorFunction(failedUpdates: (readonly [ZohoAccessTokenCache, unknown])[]) {
  console.warn(`mergeZohoAccountsAccessTokenCacheServices(): failed updating ${failedUpdates.length} caches.`);
  failedUpdates.forEach(([_x, e], i) => {
    console.warn(`Cache update failure ${i + 1}: - ${e}`);
  });
}

/**
 * Merges the input services in order to use some as a backup source.
 *
 * If once source fails retrieval, the next will be tried.
 *
 * When updating a cached token, it will update the token across all services.
 *
 * Read fall-through is delegated to {@link mergeAsyncValueCaches} after wrapping each
 * underlying cache with an {@link isExpired}-aware filter, so an expired cached token
 * never short-circuits the lookup. Updates and clears run across all services in parallel
 * via `Promise.allSettled`, mirroring the previous behavior, with optional error logging.
 *
 * @param inputServicesToMerge - Cache services to merge in priority order. Must include at least one service.
 * @param logError - Optional error logging toggle or custom logging function.
 * @returns A merged ZohoAccountsAccessTokenCacheService that delegates across all inputs.
 * @throws {Error} When `inputServicesToMerge` is empty.
 */
export function mergeZohoAccountsAccessTokenCacheServices(inputServicesToMerge: ZohoAccountsAccessTokenCacheService[], logError?: Maybe<boolean | LogMergeZohoAccountsAccessTokenCacheServiceErrorFunction>): ZohoAccountsAccessTokenCacheService {
  const services = [...inputServicesToMerge];
  const logErrorFunction = typeof logError === 'function' ? logError : logError === false ? undefined : logMergeZohoAccountsAccessTokenCacheServiceErrorFunction;

  if (services.length === 0) {
    throw new Error('mergeZohoAccountsAccessTokenCacheServices() input cannot be empty.');
  }

  function loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache {
    const accessCachesForService = services.map((x) => x.loadZohoAccessTokenCache(service));

    // Per-cache adapters with expiry filtering so reads fall through to the next tier when a cache holds an expired token.
    const readAdapters: AsyncValueCache<ZohoAccessToken>[] = accessCachesForService.map(buildZohoReadAdapter);
    const merged = mergeAsyncValueCaches(readAdapters);

    return {
      loadCachedToken: () => merged.load(),
      updateCachedToken: async (accessToken) => {
        const settled = await Promise.allSettled(accessCachesForService.map((cache) => updateZohoCacheCapturingError(cache, accessToken)));

        if (logErrorFunction != null) {
          const failedUpdates = filterMaybeArrayValues(settled.map((y) => (y as PromiseFulfilledResult<unknown>).value)) as (readonly [ZohoAccessTokenCache, unknown])[];

          if (failedUpdates.length) {
            logErrorFunction(failedUpdates);
          }
        }
      },
      clearCachedToken: async () => {
        await Promise.allSettled(accessCachesForService.map((cache) => cache.clearCachedToken()));
      }
    };
  }

  return { loadZohoAccessTokenCache };
}

// MARK: Memory Access Token Cache
/**
 * Creates a ZohoAccountsAccessTokenCacheService that uses in-memory storage.
 *
 * Backed by {@link inMemoryAsyncKeyedValueCache} so all per-service caches share the
 * same record instance.
 *
 * @param existingCache - Optional pre-populated token cache record to use as initial state.
 * @param logAccessToConsole - Whether to log cache reads and writes to the console.
 * @returns A ZohoAccountsAccessTokenCacheService backed by in-memory storage.
 */
export function memoryZohoAccountsAccessTokenCacheService(existingCache?: ZohoAccountsAccessTokenCacheRecord, logAccessToConsole?: boolean): ZohoAccountsAccessTokenCacheService {
  const initialEntries: Record<string, ZohoAccessToken> = {};

  if (existingCache != null) {
    for (const key of Object.keys(existingCache)) {
      const value = existingCache[key];
      if (value != null) {
        initialEntries[key] = value;
      }
    }
  }

  const cache = inMemoryAsyncKeyedValueCache<ZohoAccessToken>(initialEntries);

  function loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache {
    return {
      loadCachedToken: async () => {
        const token = await cache.get(service);

        if (logAccessToConsole) {
          console.log('retrieving access token from memory: ', { service, hit: token != null, expiresAt: token?.expiresAt });
        }

        return token;
      },
      updateCachedToken: async (accessToken) => {
        await cache.set(service, accessToken);

        if (logAccessToConsole) {
          console.log('updating access token in memory: ', { service, expiresAt: accessToken?.expiresAt });
        }
      },
      clearCachedToken: async () => {
        await cache.remove(service);

        if (logAccessToConsole) {
          console.log('clearing access token in memory: ', { service });
        }
      }
    };
  }

  return { loadZohoAccessTokenCache };
}
