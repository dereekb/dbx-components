import { Injectable } from '@nestjs/common';
import { type ZoomAccessToken, type ZoomAccessTokenCache } from '@dereekb/zoom';
import { type AsyncValueCache, type Maybe, filterMaybeArrayValues, inMemoryAsyncValueCache, isExpired, mergeAsyncValueCaches } from '@dereekb/util';
import { createJsonFileAsyncValueCache, createMemoizedJsonFileAsyncValueCache, readJsonFile, removeFile, writeJsonFile } from '@dereekb/nestjs';
import { dirname } from 'node:path';

/**
 * Service used for retrieving ZoomAccessTokenCache for Zoom services.
 */
@Injectable()
export abstract class ZoomOAuthAccessTokenCacheService {
  /**
   * Loads an ZoomAccessTokenCache for the given service key.
   *
   * @param service
   */
  abstract loadZoomAccessTokenCache(): ZoomAccessTokenCache;
  /**
   * Creates or retrieves a cache for the given refresh token.
   *
   * @param refreshToken
   */
  abstract cacheForRefreshToken?(refreshToken: string): ZoomAccessTokenCache;
}

export type ZoomOAuthAccessTokenCacheServiceWithRefreshToken = Required<ZoomOAuthAccessTokenCacheService>;

// MARK: Merge
export type LogMergeZoomOAuthAccessTokenCacheServiceErrorFunction = (failedUpdates: (readonly [ZoomAccessTokenCache, unknown])[]) => void;

/**
 * Default error logging function for merged cache service update failures.
 *
 * @param failedUpdates Array of failed cache update results with their errors
 */
export function logMergeZoomOAuthAccessTokenCacheServiceErrorFunction(failedUpdates: (readonly [ZoomAccessTokenCache, unknown])[]) {
  console.warn(`mergeZoomOAuthAccessTokenCacheServices(): failed updating ${failedUpdates.length} caches.`);
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
 * never short-circuits the lookup. Updates run across all services in parallel via
 * `Promise.allSettled`, mirroring the previous behavior, with optional error logging.
 *
 * @param inputServicesToMerge Must include at least one service. Empty arrays will throw an error.
 * @param logError Optional error logging configuration. Pass a function, true for default logging, or false to disable.
 * @returns A merged ZoomOAuthAccessTokenCacheService
 */
export function mergeZoomOAuthAccessTokenCacheServices(inputServicesToMerge: ZoomOAuthAccessTokenCacheService[], logError?: Maybe<boolean | LogMergeZoomOAuthAccessTokenCacheServiceErrorFunction>): ZoomOAuthAccessTokenCacheService {
  const allServices = [...inputServicesToMerge];
  const logErrorFunction = typeof logError === 'function' ? logError : logError !== false ? logMergeZoomOAuthAccessTokenCacheServiceErrorFunction : undefined;

  if (allServices.length === 0) {
    throw new Error('mergeZoomOAuthAccessTokenCacheServices() input cannot be empty.');
  }

  function mergeCachesForService(accessCachesForServices: ZoomAccessTokenCache[]): ZoomAccessTokenCache {
    // Per-cache adapters with expiry filtering so reads fall through to the next tier when a cache holds an expired token.
    const readAdapters: AsyncValueCache<ZoomAccessToken>[] = accessCachesForServices.map((cache) => ({
      load: async () => {
        const value = await cache.loadCachedToken().catch(() => undefined);
        return value != null && !isExpired(value) ? value : undefined;
      },
      update: (token) => cache.updateCachedToken(token),
      clear: async () => {
        // ZoomAccessTokenCache does not expose a clear method.
      }
    }));

    const merged = mergeAsyncValueCaches(readAdapters);

    return {
      loadCachedToken: () => merged.load(),
      updateCachedToken: async (accessToken) => {
        const settled = await Promise.allSettled(
          accessCachesForServices.map((cache) =>
            cache
              .updateCachedToken(accessToken)
              .then(() => null)
              .catch((e) => [cache, e] as const)
          )
        );

        if (logErrorFunction != null) {
          const failedUpdates = filterMaybeArrayValues(settled.map((y) => (y as PromiseFulfilledResult<unknown>).value)) as (readonly [ZoomAccessTokenCache, unknown])[];

          if (failedUpdates.length) {
            logErrorFunction(failedUpdates);
          }
        }
      }
    };
  }

  const allServiceAccessTokenCaches = allServices.map((service) => service.loadZoomAccessTokenCache());
  const allServicesWithCacheForRefreshToken = allServices.filter((service) => service.cacheForRefreshToken != null) as ZoomOAuthAccessTokenCacheServiceWithRefreshToken[];

  const cacheForRefreshToken =
    allServicesWithCacheForRefreshToken.length > 0
      ? (refreshToken: string): ZoomAccessTokenCache => {
          const allCaches = allServicesWithCacheForRefreshToken.map((x) => x.cacheForRefreshToken(refreshToken));
          return mergeCachesForService(allCaches);
        }
      : undefined;

  const service: ZoomOAuthAccessTokenCacheService = {
    loadZoomAccessTokenCache: () => mergeCachesForService(allServiceAccessTokenCaches),
    cacheForRefreshToken
  };

  return service;
}

// MARK: Memory Access Token Cache
/**
 * Creates a ZoomOAuthAccessTokenCacheService that uses in-memory storage.
 *
 * Backed by {@link inMemoryAsyncValueCache} so all consumers share the same single token slot.
 *
 * @param existingToken Optional initial token to seed the cache with
 * @param logAccessToConsole Whether to log token access to console
 * @returns A memory-backed ZoomOAuthAccessTokenCacheService
 */
export function memoryZoomOAuthAccessTokenCacheService(existingToken?: Maybe<ZoomAccessToken>, logAccessToConsole?: boolean): ZoomOAuthAccessTokenCacheService {
  const cache = inMemoryAsyncValueCache<ZoomAccessToken>(existingToken);

  function loadZoomAccessTokenCache(): ZoomAccessTokenCache {
    return {
      loadCachedToken: async () => {
        const token = await cache.load();

        if (logAccessToConsole) {
          console.log('retrieving access token from memory: ', { token });
        }

        return token;
      },
      updateCachedToken: async (accessToken) => {
        await cache.update(accessToken);

        if (logAccessToConsole) {
          console.log('updating access token in memory: ', { accessToken });
        }
      }
    };
  }

  return {
    loadZoomAccessTokenCache,
    cacheForRefreshToken: () => loadZoomAccessTokenCache()
  };
}

export interface FileSystemZoomOAuthAccessTokenCacheService extends ZoomOAuthAccessTokenCacheService {
  readTokenFile(): Promise<Maybe<ZoomOAuthAccessTokenCacheFileContent>>;
  writeTokenFile(token: ZoomOAuthAccessTokenCacheFileContent): Promise<void>;
  deleteTokenFile(): Promise<void>;
}

// MARK: File System Access Token Cache
export const DEFAULT_FILE_ZOOM_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH = '.tmp/zoom-access-tokens.json';

export type ZoomOAuthAccessTokenCacheFileContent = {
  readonly token?: Maybe<ZoomAccessToken>;
};

/**
 * Reviver applied to the cached file payload on load so `expiresAt` is always a `Date`
 * regardless of how it was serialized.
 *
 * @param raw - the raw JSON-parsed file payload
 * @returns the revived ZoomAccessToken, or undefined when the payload is empty/invalid
 */
function reviveZoomAccessTokenFile(raw: unknown): Maybe<ZoomAccessToken> {
  if (raw == null || typeof raw !== 'object') {
    return undefined;
  }

  const wrapper = raw as ZoomOAuthAccessTokenCacheFileContent;
  const token = wrapper.token;

  if (token == null) {
    return undefined;
  }

  const rawExpiresAt = (token as ZoomAccessToken & { expiresAt?: unknown }).expiresAt;
  const expiresAt = rawExpiresAt != null && !(rawExpiresAt instanceof Date) ? new Date(rawExpiresAt as string | number) : (rawExpiresAt as Date | undefined);

  return { ...token, expiresAt: expiresAt as Date };
}

/**
 * Creates a ZoomOAuthAccessTokenCacheService that reads and writes the access token to the file system.
 *
 * Composes {@link createMemoizedJsonFileAsyncValueCache} (for the on-disk slot, with optional
 * per-process memoization) so reads after the first hit memory.
 *
 * Useful for testing.
 *
 * @param filename Path to the token cache file
 * @param useMemoryCache Whether to also cache tokens in memory for faster access
 * @returns A file-system-backed ZoomOAuthAccessTokenCacheService
 */
export function fileZoomOAuthAccessTokenCacheService(filename: string = DEFAULT_FILE_ZOOM_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH, useMemoryCache = true): FileSystemZoomOAuthAccessTokenCacheService {
  const innerCacheInput = {
    filePath: filename,
    reviver: reviveZoomAccessTokenFile,
    replacer: (token: ZoomAccessToken): ZoomOAuthAccessTokenCacheFileContent => ({ token })
  };

  const cache: AsyncValueCache<ZoomAccessToken> = useMemoryCache ? createMemoizedJsonFileAsyncValueCache<ZoomAccessToken>(innerCacheInput) : createJsonFileAsyncValueCache<ZoomAccessToken>(innerCacheInput);

  function loadZoomAccessTokenCache(): ZoomAccessTokenCache {
    return {
      loadCachedToken: () => cache.load(),
      updateCachedToken: async (accessToken) => {
        try {
          await cache.update(accessToken);
        } catch (e) {
          console.error('Failed updating access token in file: ', e);
        }
      }
    };
  }

  async function readTokenFile(): Promise<Maybe<ZoomOAuthAccessTokenCacheFileContent>> {
    const raw = await readJsonFile<ZoomOAuthAccessTokenCacheFileContent>(filename);

    if (raw == null) {
      return undefined;
    }

    const token = reviveZoomAccessTokenFile(raw);
    return { token };
  }

  async function writeTokenFile(content: ZoomOAuthAccessTokenCacheFileContent): Promise<void> {
    await writeJsonFile({
      filePath: filename,
      dirPath: dirname(filename),
      data: content
    });
  }

  async function deleteTokenFile(): Promise<void> {
    await removeFile(filename);
  }

  return {
    loadZoomAccessTokenCache,
    readTokenFile,
    writeTokenFile,
    deleteTokenFile
  };
}
