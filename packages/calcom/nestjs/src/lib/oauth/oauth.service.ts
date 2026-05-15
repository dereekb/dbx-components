import { Injectable } from '@nestjs/common';
import { type CalcomAccessToken, type CalcomAccessTokenCache, type CalcomRefreshToken } from '@dereekb/calcom';
import { type AsyncValueCache, type Maybe, filterMaybeArrayValues, inMemoryAsyncKeyedValueCache, inMemoryAsyncValueCache, isExpired, mergeAsyncValueCaches } from '@dereekb/util';
import { createMemoizedJsonFileAsyncValueCache } from '@dereekb/nestjs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * Service used for retrieving CalcomAccessTokenCache for Cal.com services.
 *
 * Implementations store and retrieve OAuth access tokens (and the rotated refresh tokens
 * embedded in them). The service supports both a server-level cache and per-user caches
 * keyed by the user's initial refresh token.
 */
@Injectable()
export abstract class CalcomOAuthAccessTokenCacheService {
  /**
   * Loads the server-level CalcomAccessTokenCache.
   */
  abstract loadCalcomAccessTokenCache(): CalcomAccessTokenCache;
  /**
   * Creates or retrieves a cache for a specific user context, keyed by the refresh token.
   *
   * The refresh token is hashed to derive a stable cache key. Even though Cal.com
   * rotates refresh tokens, the cache instance persists the updated token in-place,
   * so subsequent reads return the latest token regardless of rotation.
   */
  abstract cacheForRefreshToken?(refreshToken: CalcomRefreshToken): CalcomAccessTokenCache;
}

export type CalcomOAuthAccessTokenCacheServiceWithRefreshToken = Required<CalcomOAuthAccessTokenCacheService>;

/**
 * Derives a short, filesystem-safe cache key from a refresh token.
 *
 * Uses SHA-256 truncated to 16 hex chars; the goal is fingerprinting, not security.
 *
 * @param refreshToken - the OAuth refresh token to hash
 * @returns a 16-character hex string suitable for use as a cache key
 */
export function calcomRefreshTokenCacheKey(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex').substring(0, 16);
}

// MARK: Merge
function buildCalcomReadAdapter(cache: CalcomAccessTokenCache): AsyncValueCache<CalcomAccessToken> {
  return {
    load: async () => {
      const value = await cache.loadCachedToken().catch(() => undefined);
      return value != null && !isExpired(value) ? value : undefined;
    },
    update: (token) => cache.updateCachedToken(token),
    clear: async () => {
      // CalcomAccessTokenCache does not expose a clear method.
    }
  };
}

function updateCalcomCacheCapturingError(cache: CalcomAccessTokenCache, accessToken: CalcomAccessToken): Promise<null | readonly [CalcomAccessTokenCache, unknown]> {
  return cache
    .updateCachedToken(accessToken)
    .then(() => null)
    .catch((e: unknown) => [cache, e] as const);
}

export type LogMergeCalcomOAuthAccessTokenCacheServiceErrorFunction = (failedUpdates: (readonly [CalcomAccessTokenCache, unknown])[]) => void;

/**
 * Default error logging function for {@link mergeCalcomOAuthAccessTokenCacheServices}.
 * Logs a warning for each cache that failed to update.
 *
 * @param failedUpdates - array of tuples containing the failed cache and its error
 */
export function logMergeCalcomOAuthAccessTokenCacheServiceErrorFunction(failedUpdates: (readonly [CalcomAccessTokenCache, unknown])[]) {
  console.warn(`mergeCalcomOAuthAccessTokenCacheServices(): failed updating ${failedUpdates.length} caches.`);
  failedUpdates.forEach(([_cache, e], i) => {
    console.warn(`Cache update failure ${i + 1}: - ${e}`);
  });
}

/**
 * Merges the input services in order to use some as a backup source.
 *
 * If one source fails retrieval, the next will be tried.
 * When updating a cached token, it will update the token across all services.
 *
 * Read fall-through is delegated to {@link mergeAsyncValueCaches} after wrapping each
 * underlying cache with an {@link isExpired}-aware filter, so an expired cached token
 * never short-circuits the lookup. Updates run across all services in parallel via
 * `Promise.allSettled`, mirroring the previous behavior, with optional error logging.
 *
 * @param inputServicesToMerge Must include at least one service. Empty arrays will throw an error.
 * @param logError - optional error logging configuration; pass a function, true for default logging, or false to disable
 * @returns a merged CalcomOAuthAccessTokenCacheService that delegates across all input services
 */
export function mergeCalcomOAuthAccessTokenCacheServices(inputServicesToMerge: CalcomOAuthAccessTokenCacheService[], logError?: Maybe<boolean | LogMergeCalcomOAuthAccessTokenCacheServiceErrorFunction>): CalcomOAuthAccessTokenCacheService {
  const allServices = [...inputServicesToMerge];
  const logErrorFunction = typeof logError === 'function' ? logError : logError !== false ? logMergeCalcomOAuthAccessTokenCacheServiceErrorFunction : undefined;

  if (allServices.length === 0) {
    throw new Error('mergeCalcomOAuthAccessTokenCacheServices() input cannot be empty.');
  }

  function mergeCachesForService(accessCachesForServices: CalcomAccessTokenCache[]): CalcomAccessTokenCache {
    const readAdapters: AsyncValueCache<CalcomAccessToken>[] = accessCachesForServices.map(buildCalcomReadAdapter);
    const merged = mergeAsyncValueCaches(readAdapters);

    return {
      loadCachedToken: () => merged.load(),
      updateCachedToken: async (accessToken) => {
        const settled = await Promise.allSettled(accessCachesForServices.map((cache) => updateCalcomCacheCapturingError(cache, accessToken)));

        if (logErrorFunction != null) {
          const failedUpdates = filterMaybeArrayValues(settled.map((y) => (y as PromiseFulfilledResult<unknown>).value)) as (readonly [CalcomAccessTokenCache, unknown])[];

          if (failedUpdates.length) {
            logErrorFunction(failedUpdates);
          }
        }
      }
    };
  }

  const allServiceAccessTokenCaches = allServices.map((x) => x.loadCalcomAccessTokenCache());
  const allServicesWithCacheForRefreshToken = allServices.filter((x) => x.cacheForRefreshToken != null) as CalcomOAuthAccessTokenCacheServiceWithRefreshToken[];

  const cacheForRefreshToken =
    allServicesWithCacheForRefreshToken.length > 0
      ? (refreshToken: CalcomRefreshToken): CalcomAccessTokenCache => {
          const allCaches = allServicesWithCacheForRefreshToken.map((x) => x.cacheForRefreshToken(refreshToken));
          return mergeCachesForService(allCaches);
        }
      : undefined;

  const service: CalcomOAuthAccessTokenCacheService = {
    loadCalcomAccessTokenCache: () => mergeCachesForService(allServiceAccessTokenCaches),
    cacheForRefreshToken
  };

  return service;
}

// MARK: Memory Access Token Cache
/**
 * Adapts an {@link AsyncValueCache} to a {@link CalcomAccessTokenCache}, optionally logging cache reads/writes to the console.
 *
 * @param cache - underlying single-value cache for the access token
 * @param logAccessToConsole - when true, logs reads and writes to the console
 * @returns the CalcomAccessTokenCache backed by the given async cache
 */
function calcomAccessTokenCacheFromAsyncValueCache(cache: AsyncValueCache<CalcomAccessToken>, logAccessToConsole: boolean | undefined): CalcomAccessTokenCache {
  return {
    loadCachedToken: async () => {
      const token = await cache.load();
      if (logAccessToConsole) {
        console.log('retrieving access token from memory: ', { hit: token != null, expiresAt: token?.expiresAt });
      }
      return token;
    },
    updateCachedToken: async (accessToken) => {
      await cache.update(accessToken);
      if (logAccessToConsole) {
        console.log('updating access token in memory: ', { expiresAt: accessToken?.expiresAt });
      }
    }
  };
}

/**
 * Creates a CalcomOAuthAccessTokenCacheService that uses in-memory storage.
 *
 * The server-level token is held in a single-slot {@link inMemoryAsyncValueCache};
 * per-user tokens are held in an {@link inMemoryAsyncKeyedValueCache} keyed by the
 * sha256-truncated refresh token hash.
 *
 * @param existingToken - optional pre-existing server-level access token to seed the cache
 * @param logAccessToConsole - when true, logs all cache reads and writes to console
 * @returns a CalcomOAuthAccessTokenCacheService backed by in-memory caches
 */
export function memoryCalcomOAuthAccessTokenCacheService(existingToken?: Maybe<CalcomAccessToken>, logAccessToConsole?: boolean): CalcomOAuthAccessTokenCacheService {
  const serverCache = inMemoryAsyncValueCache<CalcomAccessToken>(existingToken);
  const userCache = inMemoryAsyncKeyedValueCache<CalcomAccessToken>();

  function userCacheView(key: string): AsyncValueCache<CalcomAccessToken> {
    return {
      load: () => userCache.get(key),
      update: (token) => userCache.set(key, token),
      clear: () => userCache.remove(key)
    };
  }

  return {
    loadCalcomAccessTokenCache: () => calcomAccessTokenCacheFromAsyncValueCache(serverCache, logAccessToConsole),
    cacheForRefreshToken: (refreshToken: CalcomRefreshToken) => {
      const key = calcomRefreshTokenCacheKey(refreshToken);
      return calcomAccessTokenCacheFromAsyncValueCache(userCacheView(key), logAccessToConsole);
    }
  };
}

// MARK: File System Access Token Cache
export const DEFAULT_FILE_CALCOM_ACCESS_TOKEN_CACHE_DIR = '.tmp/calcom-tokens';
export const CALCOM_SERVER_TOKEN_FILE_KEY = 'server';

export type CalcomOAuthAccessTokenCacheFileContent = {
  readonly token?: Maybe<CalcomAccessToken>;
};

export interface FileSystemCalcomOAuthAccessTokenCacheService extends CalcomOAuthAccessTokenCacheService {
  readonly cacheDir: string;
}

/**
 * Reviver applied to the cached file payload on load so `expiresAt` is always a `Date`
 * regardless of how it was serialized.
 *
 * @param raw - the raw JSON-parsed file payload
 * @returns the revived CalcomAccessToken, or undefined when the payload is empty/invalid
 */
function reviveCalcomAccessTokenFile(raw: unknown): Maybe<CalcomAccessToken> {
  if (raw == null || typeof raw !== 'object') {
    return undefined;
  }

  const wrapper = raw as CalcomOAuthAccessTokenCacheFileContent;
  const token = wrapper.token;

  if (token == null) {
    return undefined;
  }

  const rawExpiresAt = (token as CalcomAccessToken & { expiresAt?: unknown }).expiresAt;
  const expiresAt = rawExpiresAt != null && !(rawExpiresAt instanceof Date) ? new Date(rawExpiresAt as string | number) : rawExpiresAt;

  return { ...token, expiresAt: expiresAt as Date };
}

/**
 * Creates a CalcomOAuthAccessTokenCacheService that reads and writes access tokens
 * to the file system. Each user gets their own file, keyed by an sha256 hash of their refresh token.
 *
 * Backed by {@link createMemoizedJsonFileAsyncValueCache} for each key, so reads after
 * the first hit memory.
 *
 * File structure:
 * ```
 * <cacheDir>/
 *   server.json              — server-level token
 *   user-<sha256hash>.json   — per-user tokens (hash of initial refresh token)
 * ```
 *
 * @param cacheDir Directory to store token files. Defaults to `.tmp/calcom-tokens`.
 * @returns a CalcomOAuthAccessTokenCacheService backed by the file system
 */
export function fileCalcomOAuthAccessTokenCacheService(cacheDir: string = DEFAULT_FILE_CALCOM_ACCESS_TOKEN_CACHE_DIR): FileSystemCalcomOAuthAccessTokenCacheService {
  const cachesByKey = new Map<string, AsyncValueCache<CalcomAccessToken>>();

  function cacheForKey(fileKey: string): AsyncValueCache<CalcomAccessToken> {
    let cache = cachesByKey.get(fileKey);

    if (cache == null) {
      cache = createMemoizedJsonFileAsyncValueCache<CalcomAccessToken>({
        filePath: join(cacheDir, `${fileKey}.json`),
        reviver: reviveCalcomAccessTokenFile,
        replacer: (token: CalcomAccessToken): CalcomOAuthAccessTokenCacheFileContent => ({ token })
      });
      cachesByKey.set(fileKey, cache);
    }

    return cache;
  }

  function makeCacheForKey(fileKey: string): CalcomAccessTokenCache {
    const cache = cacheForKey(fileKey);

    return {
      loadCachedToken: () => cache.load(),
      updateCachedToken: async (accessToken) => {
        try {
          await cache.update(accessToken);
        } catch (e) {
          console.error(`Failed updating token file for ${fileKey}: `, e);
          throw e;
        }
      }
    };
  }

  return {
    cacheDir,
    loadCalcomAccessTokenCache: () => makeCacheForKey(CALCOM_SERVER_TOKEN_FILE_KEY),
    cacheForRefreshToken: (refreshToken: CalcomRefreshToken) => makeCacheForKey(`user-${calcomRefreshTokenCacheKey(refreshToken)}`)
  };
}
