import { Injectable } from '@nestjs/common';
import { type ZohoAccessToken, type ZohoAccessTokenCache, type ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { type AsyncValueCache, type Maybe, filterMaybeArrayValues, inMemoryAsyncKeyedValueCache, isExpired, memoizeAsyncKeyedValueCache, mergeAsyncValueCaches } from '@dereekb/util';
import { createJsonFileAsyncKeyedValueCache, readJsonFile, removeFile, writeJsonFile } from '@dereekb/nestjs';
import { dirname } from 'node:path';

export type ZohoAccountsAccessTokenCacheRecord = Record<ZohoServiceAccessTokenKey, Maybe<ZohoAccessToken>>;

/**
 * Service used for retrieving ZohoAccessTokenCache for Zoho services.
 */
@Injectable()
export abstract class ZohoAccountsAccessTokenCacheService {
  /**
   * Loads an ZohoAccessTokenCache for the given service key.
   *
   * @param service
   */
  abstract loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache;
}

export type LogMergeZohoAccountsAccessTokenCacheServiceErrorFunction = (failedUpdates: (readonly [ZohoAccessTokenCache, unknown])[]) => void;

/**
 * Default error logging function for merged Zoho access token cache services.
 *
 * @param failedUpdates - array of cache/error tuples that failed during update
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
 * @param servicesToMerge Must include atleast one service. Empty arrays will throw an error.
 * @param inputServicesToMerge - cache services to merge in priority order
 * @param logError - optional error logging toggle or custom logging function
 * @returns a merged ZohoAccountsAccessTokenCacheService that delegates across all inputs
 */
export function mergeZohoAccountsAccessTokenCacheServices(inputServicesToMerge: ZohoAccountsAccessTokenCacheService[], logError?: Maybe<boolean | LogMergeZohoAccountsAccessTokenCacheServiceErrorFunction>): ZohoAccountsAccessTokenCacheService {
  const services = [...inputServicesToMerge];
  const logErrorFunction = typeof logError === 'function' ? logError : logError !== false ? logMergeZohoAccountsAccessTokenCacheServiceErrorFunction : undefined;

  if (services.length === 0) {
    throw new Error('mergeZohoAccountsAccessTokenCacheServices() input cannot be empty.');
  }

  function loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache {
    const accessCachesForService = services.map((x) => x.loadZohoAccessTokenCache(service));

    // Per-cache adapters with expiry filtering so reads fall through to the next tier when a cache holds an expired token.
    const readAdapters: AsyncValueCache<ZohoAccessToken>[] = accessCachesForService.map((cache) => ({
      load: async () => {
        const value = await cache.loadCachedToken().catch(() => undefined);
        return value != null && !isExpired(value) ? value : undefined;
      },
      update: (token) => cache.updateCachedToken(token),
      clear: () => cache.clearCachedToken()
    }));

    const merged = mergeAsyncValueCaches(readAdapters);

    return {
      loadCachedToken: () => merged.load(),
      updateCachedToken: async (accessToken) => {
        const settled = await Promise.allSettled(
          accessCachesForService.map((cache) =>
            cache
              .updateCachedToken(accessToken)
              .then(() => null)
              .catch((e) => [cache, e] as const)
          )
        );

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
 * @param existingCache - optional pre-populated token cache record to use as initial state
 * @param logAccessToConsole - whether to log cache reads and writes to the console
 * @returns a ZohoAccountsAccessTokenCacheService backed by in-memory storage
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
          console.log('retrieving access token from memory: ', { token, service });
        }

        return token;
      },
      updateCachedToken: async (accessToken) => {
        await cache.set(service, accessToken);

        if (logAccessToConsole) {
          console.log('updating access token in memory: ', { accessToken, service });
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

export interface FileSystemZohoAccountsAccessTokenCacheService extends ZohoAccountsAccessTokenCacheService {
  readTokenFile(): Promise<Maybe<ZohoAccountsAccessTokenCacheRecord>>;
  writeTokenFile(tokens: ZohoAccountsAccessTokenCacheRecord): Promise<void>;
  deleteTokenFile(): Promise<void>;
}

// MARK: File System Access Token Cache
export const DEFAULT_FILE_ZOHO_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH = '.tmp/zoho-access-tokens.json';

/**
 * Reviver applied to each cached token entry on load so `expiresAt` is always a `Date`
 * regardless of how it was serialized.
 */
function reviveZohoAccessToken(raw: unknown): Maybe<ZohoAccessToken> {
  if (raw == null || typeof raw !== 'object') {
    return undefined;
  }

  const value = raw as ZohoAccessToken & { expiresAt?: unknown };
  const rawExpiresAt = value.expiresAt;
  const expiresAt = rawExpiresAt != null && !(rawExpiresAt instanceof Date) ? new Date(rawExpiresAt as string | number) : (rawExpiresAt as Date | undefined);

  return { ...(value as ZohoAccessToken), expiresAt: expiresAt as Date };
}

/**
 * Creates a ZohoAccountsAccessTokenCacheService that reads and writes the access token to the file system.
 *
 * Composes {@link createJsonFileAsyncKeyedValueCache} (for the on-disk record) optionally with
 * {@link memoizeAsyncKeyedValueCache} so reads after the first hit memory.
 *
 * Useful for testing.
 *
 * @param filename - path to the JSON file used for token persistence
 * @param useMemoryCache - whether to also cache tokens in memory for faster reads
 * @returns a FileSystemZohoAccountsAccessTokenCacheService backed by file storage
 */
export function fileZohoAccountsAccessTokenCacheService(filename: string = DEFAULT_FILE_ZOHO_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH, useMemoryCache = true): FileSystemZohoAccountsAccessTokenCacheService {
  const fileCache = createJsonFileAsyncKeyedValueCache<ZohoAccessToken>({
    filePath: filename,
    reviver: reviveZohoAccessToken
  });

  const cache = useMemoryCache ? memoizeAsyncKeyedValueCache(fileCache) : fileCache;

  function loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache {
    return {
      loadCachedToken: () => cache.get(service),
      updateCachedToken: async (accessToken) => {
        try {
          await cache.set(service, accessToken);
        } catch (e) {
          console.error('Failed updating access token in file: ', e);
        }
      },
      clearCachedToken: async () => {
        try {
          await cache.remove(service);
        } catch (e) {
          console.error('Failed clearing access token in file: ', e);
        }
      }
    };
  }

  async function readTokenFile(): Promise<Maybe<ZohoAccountsAccessTokenCacheRecord>> {
    const raw = await readJsonFile<Record<string, unknown>>(filename);

    if (raw == null) {
      return undefined;
    }

    const result: ZohoAccountsAccessTokenCacheRecord = {};
    for (const key of Object.keys(raw)) {
      result[key] = reviveZohoAccessToken(raw[key]);
    }

    return result;
  }

  async function writeTokenFile(tokens: ZohoAccountsAccessTokenCacheRecord): Promise<void> {
    await writeJsonFile({
      filePath: filename,
      dirPath: dirname(filename),
      data: tokens
    });
  }

  async function deleteTokenFile(): Promise<void> {
    await removeFile(filename);
  }

  return {
    loadZohoAccessTokenCache,
    readTokenFile,
    writeTokenFile,
    deleteTokenFile
  };
}
