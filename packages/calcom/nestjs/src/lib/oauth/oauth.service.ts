import { Injectable } from '@nestjs/common';
import { type CalcomAccessToken, type CalcomAccessTokenCache } from '@dereekb/calcom';
import { type Maybe, type Configurable, filterMaybeArrayValues, tryWithPromiseFactoriesFunction, isPast } from '@dereekb/util';
import { dirname } from 'path';
import { readFile, writeFile, rm, mkdirSync } from 'fs';

/**
 * Service used for retrieving CalcomAccessTokenCache for Cal.com services.
 */
@Injectable()
export abstract class CalcomOAuthAccessTokenCacheService {
  /**
   * Loads a CalcomAccessTokenCache for the service.
   */
  abstract loadCalcomAccessTokenCache(): CalcomAccessTokenCache;
  /**
   * Creates or retrieves a cache for the given refresh token.
   *
   * Cal.com uses per-user OAuth tokens, so this is used to cache tokens per mentor/user.
   */
  abstract cacheForRefreshToken?(refreshToken: string): CalcomAccessTokenCache;
}

export type CalcomOAuthAccessTokenCacheServiceWithRefreshToken = Required<CalcomOAuthAccessTokenCacheService>;

// MARK: Merge
export type LogMergeCalcomOAuthAccessTokenCacheServiceErrorFunction = (failedUpdates: (readonly [CalcomAccessTokenCache, unknown])[]) => void;

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
 *
 * When updating a cached token, it will update the token across all services.
 *
 * @param inputServicesToMerge Must include at least one service. Empty arrays will throw an error.
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
      ? (refreshToken: string): CalcomAccessTokenCache => {
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
 */
export function memoryCalcomOAuthAccessTokenCacheService(existingToken?: Maybe<CalcomAccessToken>, logAccessToConsole?: boolean): CalcomOAuthAccessTokenCacheService {
  let token: Maybe<CalcomAccessToken> = existingToken;

  function loadCalcomAccessTokenCache(): CalcomAccessTokenCache {
    const accessTokenCache: CalcomAccessTokenCache = {
      loadCachedToken: async function (): Promise<Maybe<CalcomAccessToken>> {
        if (logAccessToConsole) {
          console.log('retrieving access token from memory: ', { token });
        }
        return token;
      },
      updateCachedToken: async function (accessToken: CalcomAccessToken): Promise<void> {
        token = accessToken;
        if (logAccessToConsole) {
          console.log('updating access token in memory: ', { accessToken });
        }
      }
    };

    return accessTokenCache;
  }

  return {
    loadCalcomAccessTokenCache,
    cacheForRefreshToken: () => loadCalcomAccessTokenCache()
  };
}

export interface FileSystemCalcomOAuthAccessTokenCacheService extends CalcomOAuthAccessTokenCacheService {
  readTokenFile(): Promise<Maybe<CalcomOAuthAccessTokenCacheFileContent>>;
  writeTokenFile(token: CalcomOAuthAccessTokenCacheFileContent): Promise<void>;
  deleteTokenFile(): Promise<void>;
}

// MARK: File System Access Token Cache
export const DEFAULT_FILE_CALCOM_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH = '.tmp/calcom-access-tokens.json';

export type CalcomOAuthAccessTokenCacheFileContent = {
  readonly token?: Maybe<CalcomAccessToken>;
};

/**
 * Creates a CalcomOAuthAccessTokenCacheService that reads and writes the access token to the file system.
 *
 * Useful for testing.
 */
export function fileCalcomOAuthAccessTokenCacheService(filename: string = DEFAULT_FILE_CALCOM_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH, useMemoryCache = true): FileSystemCalcomOAuthAccessTokenCacheService {
  let loadedToken: Maybe<CalcomOAuthAccessTokenCacheFileContent> = null;

  async function loadTokenFile(): Promise<CalcomOAuthAccessTokenCacheFileContent> {
    let token: Maybe<CalcomOAuthAccessTokenCacheFileContent> = undefined;

    if (!loadedToken) {
      token = (await readTokenFile()) ?? {};
    } else {
      token = loadedToken;
    }

    return token;
  }

  function readTokenFile(): Promise<Maybe<CalcomOAuthAccessTokenCacheFileContent>> {
    return new Promise<Maybe<CalcomOAuthAccessTokenCacheFileContent>>((resolve) => {
      mkdirSync(dirname(filename), { recursive: true }); // make the directory first
      readFile(filename, {}, (x, data) => {
        let result: Maybe<CalcomOAuthAccessTokenCacheFileContent> = undefined;

        if (!x) {
          try {
            result = JSON.parse(data.toString());

            if (result?.token) {
              (result.token as Configurable<CalcomAccessToken>).expiresAt = new Date(result.token.expiresAt);
            }
          } catch (e) {
            console.error('Failed reading token file: ', e);
          }
        }

        resolve(result);
      });
    }).then((x) => {
      // update loaded tokens
      if (useMemoryCache) {
        loadedToken = {
          ...loadedToken,
          ...x
        };
      }

      return x;
    });
  }

  async function writeTokenFile(tokens: CalcomOAuthAccessTokenCacheFileContent): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      writeFile(filename, JSON.stringify(tokens), {}, (x) => {
        if (!x) {
          resolve();
        } else {
          reject(x);
        }
      });
    });
  }

  async function deleteTokenFile(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      rm(filename, (x) => {
        if (!x) {
          resolve();
        } else {
          reject(x);
        }
      });
    });
  }

  function loadCalcomAccessTokenCache(): CalcomAccessTokenCache {
    const accessTokenCache: CalcomAccessTokenCache = {
      loadCachedToken: async function (): Promise<Maybe<CalcomAccessToken>> {
        const tokens = await loadTokenFile();
        const token = tokens.token;
        return token;
      },
      updateCachedToken: async function (accessToken: CalcomAccessToken): Promise<void> {
        const tokenFile = await loadTokenFile();

        if (tokenFile) {
          (tokenFile as Configurable<CalcomOAuthAccessTokenCacheFileContent>).token = accessToken;
        }

        try {
          await writeTokenFile(tokenFile);
        } catch (e) {
          console.error('Failed updating access token in file: ', e);
        }
      }
    };

    return accessTokenCache;
  }

  return {
    loadCalcomAccessTokenCache,
    readTokenFile,
    writeTokenFile,
    deleteTokenFile
  };
}
