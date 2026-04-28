import { Injectable } from '@nestjs/common';
import { type CalcomAccessToken, type CalcomAccessTokenCache, type CalcomRefreshToken } from '@dereekb/calcom';
import { type Maybe, type Configurable, filterMaybeArrayValues, tryWithPromiseFactoriesFunction, isPast } from '@dereekb/util';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { readFile, writeFile, mkdirSync } from 'node:fs';

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

  const loadCalcomAccessTokenCache = (accessCachesForServices: CalcomAccessTokenCache[]) => {
    const loadCachedTokenFromFirstService = tryWithPromiseFactoriesFunction<void, CalcomAccessToken>({
      promiseFactories: accessCachesForServices.map(
        (x) => () =>
          x
            .loadCachedToken()
            .catch(() => null)
            .then((x: Maybe<CalcomAccessToken>) => {
              let result: Maybe<CalcomAccessToken> = undefined;

              if (x && !isPast(x.expiresAt)) {
                result = x; // only return from cache if it is not expired
              }

              return result;
            })
      ),
      successOnMaybe: false,
      throwErrors: false
    });

    const cacheForService: CalcomAccessTokenCache = {
      loadCachedToken: function (): Promise<Maybe<CalcomAccessToken>> {
        return loadCachedTokenFromFirstService();
      },
      updateCachedToken: async function (accessToken: CalcomAccessToken): Promise<void> {
        return Promise.allSettled(
          accessCachesForServices.map((x) =>
            x
              .updateCachedToken(accessToken)
              .then(() => null)
              .catch((e: unknown) => {
                return [x, e] as const;
              })
          )
        ).then((x) => {
          // only find the failures if we're logging
          if (logErrorFunction != null) {
            const failedUpdates = filterMaybeArrayValues(x.map((y) => (y as PromiseFulfilledResult<any>).value)) as unknown as (readonly [CalcomAccessTokenCache, unknown])[];

            if (failedUpdates.length) {
              logErrorFunction(failedUpdates);
            }
          }
        });
      }
    };

    return cacheForService;
  };

  const allServiceAccessTokenCaches = allServices.map((x) => x.loadCalcomAccessTokenCache());
  const allServicesWithCacheForRefreshToken = allServices.filter((x) => x.cacheForRefreshToken != null) as CalcomOAuthAccessTokenCacheServiceWithRefreshToken[];

  const cacheForRefreshToken =
    allServicesWithCacheForRefreshToken.length > 0
      ? (refreshToken: CalcomRefreshToken): CalcomAccessTokenCache => {
          const allCaches = allServicesWithCacheForRefreshToken.map((x) => x.cacheForRefreshToken(refreshToken));
          return loadCalcomAccessTokenCache(allCaches);
        }
      : undefined;

  const service: CalcomOAuthAccessTokenCacheService = {
    loadCalcomAccessTokenCache: () => loadCalcomAccessTokenCache(allServiceAccessTokenCaches),
    cacheForRefreshToken
  };

  return service;
}

// MARK: Memory Access Token Cache
/**
 * Creates a CalcomOAuthAccessTokenCacheService that uses in-memory storage.
 * Per-user caches are stored in a Map keyed by the md5 hash of the refresh token.
 *
 * @param existingToken - optional pre-existing server-level access token to seed the cache
 * @param logAccessToConsole - when true, logs all cache reads and writes to console
 * @returns a CalcomOAuthAccessTokenCacheService backed by in-memory Maps
 */
export function memoryCalcomOAuthAccessTokenCacheService(existingToken?: Maybe<CalcomAccessToken>, logAccessToConsole?: boolean): CalcomOAuthAccessTokenCacheService {
  let serverToken: Maybe<CalcomAccessToken> = existingToken;
  const userTokens = new Map<string, Maybe<CalcomAccessToken>>();

  function makeCache(getToken: () => Maybe<CalcomAccessToken>, setToken: (t: CalcomAccessToken) => void): CalcomAccessTokenCache {
    return {
      loadCachedToken: async function (): Promise<Maybe<CalcomAccessToken>> {
        const token = getToken();
        if (logAccessToConsole) {
          console.log('retrieving access token from memory: ', { token });
        }

        return token;
      },
      updateCachedToken: async function (accessToken: CalcomAccessToken): Promise<void> {
        setToken(accessToken);
        if (logAccessToConsole) {
          console.log('updating access token in memory: ', { accessToken });
        }
      }
    };
  }

  return {
    loadCalcomAccessTokenCache: () =>
      makeCache(
        () => serverToken,
        (t) => {
          serverToken = t;
        }
      ),
    cacheForRefreshToken: (refreshToken: CalcomRefreshToken) => {
      const key = calcomRefreshTokenCacheKey(refreshToken);

      return makeCache(
        () => userTokens.get(key),
        (t) => userTokens.set(key, t)
      );
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
 * Creates a CalcomOAuthAccessTokenCacheService that reads and writes access tokens
 * to the file system. Each user gets their own file, keyed by an md5 hash of their refresh token.
 *
 * File structure:
 * ```
 * <cacheDir>/
 *   server.json              — server-level token
 *   user-<md5hash>.json      — per-user tokens (hash of initial refresh token)
 * ```
 *
 * @param cacheDir Directory to store token files. Defaults to `.tmp/calcom-tokens`.
 * @returns a CalcomOAuthAccessTokenCacheService backed by the file system
 */
export function fileCalcomOAuthAccessTokenCacheService(cacheDir: string = DEFAULT_FILE_CALCOM_ACCESS_TOKEN_CACHE_DIR): FileSystemCalcomOAuthAccessTokenCacheService {
  const memoryTokens = new Map<string, Maybe<CalcomOAuthAccessTokenCacheFileContent>>();

  function filePathForKey(key: string): string {
    return join(cacheDir, `${key}.json`);
  }

  function readTokenFile(filePath: string): Promise<Maybe<CalcomOAuthAccessTokenCacheFileContent>> {
    return new Promise<Maybe<CalcomOAuthAccessTokenCacheFileContent>>((resolve) => {
      mkdirSync(dirname(filePath), { recursive: true });
      readFile(filePath, {}, (err, data) => {
        let result: Maybe<CalcomOAuthAccessTokenCacheFileContent> = undefined;

        if (!err) {
          try {
            result = JSON.parse(data.toString());

            if (result?.token) {
              (result.token as Configurable<CalcomAccessToken>).expiresAt = new Date(result.token.expiresAt);
            }
          } catch (e) {
            console.error(`Failed reading token file ${filePath}: `, e);
          }
        }

        resolve(result);
      });
    });
  }

  function writeTokenFile(filePath: string, content: CalcomOAuthAccessTokenCacheFileContent): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFile(filePath, JSON.stringify(content, null, 2), {}, (err) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }

  function makeCacheForKey(fileKey: string): CalcomAccessTokenCache {
    const filePath = filePathForKey(fileKey);

    return {
      loadCachedToken: async function (): Promise<Maybe<CalcomAccessToken>> {
        // Check memory first
        const memoryEntry = memoryTokens.get(fileKey);

        if (memoryEntry !== undefined) {
          return memoryEntry?.token;
        }

        // Fall back to file
        const fileContent = await readTokenFile(filePath);
        memoryTokens.set(fileKey, fileContent ?? null);

        return fileContent?.token;
      },
      updateCachedToken: async function (accessToken: CalcomAccessToken): Promise<void> {
        const content: CalcomOAuthAccessTokenCacheFileContent = { token: accessToken };
        memoryTokens.set(fileKey, content);

        try {
          await writeTokenFile(filePath, content);
        } catch (e) {
          console.error(`Failed updating token file ${filePath}: `, e);
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
