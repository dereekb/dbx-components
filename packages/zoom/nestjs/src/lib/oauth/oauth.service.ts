import { Injectable } from '@nestjs/common';
import { ZoomAccessToken, ZoomAccessTokenCache } from '@dereekb/zoom';
import { Maybe, forEachKeyValue, Configurable, filterMaybeArrayValues, tryWithPromiseFactoriesFunction, isPast } from '@dereekb/util';
import { dirname } from 'path';
import { readFile, writeFile, rm, mkdirSync } from 'fs';

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

export function logMergeZoomOAuthAccessTokenCacheServiceErrorFunction(failedUpdates: (readonly [ZoomAccessTokenCache, unknown])[]) {
  console.warn(`mergeZoomOAuthAccessTokenCacheServices(): failed updating ${failedUpdates.length} caches.`);
  failedUpdates.forEach(([x, e], i) => {
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
 * @param servicesToMerge Must include atleast one service. Empty arrays will throw an error.
 */
export function mergeZoomOAuthAccessTokenCacheServices(inputServicesToMerge: ZoomOAuthAccessTokenCacheService[], logError?: Maybe<boolean | LogMergeZoomOAuthAccessTokenCacheServiceErrorFunction>): ZoomOAuthAccessTokenCacheService {
  const allServices = [...inputServicesToMerge];
  const logErrorFunction = typeof logError === 'function' ? logError : logError !== false ? logMergeZoomOAuthAccessTokenCacheServiceErrorFunction : undefined;

  if (allServices.length === 0) {
    throw new Error('mergeZoomOAuthAccessTokenCacheServices() input cannot be empty.');
  }

  const loadZoomAccessTokenCache = (accessCachesForServices: ZoomAccessTokenCache[]) => {
    const loadCachedTokenFromFirstService = tryWithPromiseFactoriesFunction<void, ZoomAccessToken>({
      promiseFactories: accessCachesForServices.map(
        (x) => () =>
          x
            .loadCachedToken()
            .catch(() => null)
            .then((x) => {
              let result: Maybe<ZoomAccessToken> = undefined;

              if (x && !isPast(x.expiresAt)) {
                result = x; // only return from cache if it is not expired
              }

              return result;
            })
      ),
      successOnMaybe: false,
      throwErrors: false
    });

    const cacheForService: ZoomAccessTokenCache = {
      loadCachedToken: function (): Promise<Maybe<ZoomAccessToken>> {
        return loadCachedTokenFromFirstService();
      },
      updateCachedToken: async function (accessToken: ZoomAccessToken): Promise<void> {
        return Promise.allSettled(
          accessCachesForServices.map((x) =>
            x
              .updateCachedToken(accessToken)
              .then(() => null)
              .catch((e) => {
                return [x, e] as const;
              })
          )
        ).then((x) => {
          // only find the failures if we're logging
          if (logErrorFunction != null) {
            const failedUpdates = filterMaybeArrayValues(x.map((y) => (y as PromiseFulfilledResult<any>).value)) as unknown as (readonly [ZoomAccessTokenCache, unknown])[];

            if (failedUpdates.length) {
              logErrorFunction(failedUpdates);
            }
          }
        });
      }
    };

    return cacheForService;
  };

  const allServiceAccessTokenCaches = allServices.map((x) => x.loadZoomAccessTokenCache());
  const allServicesWithCacheForRefreshToken = allServices.filter((x) => x.cacheForRefreshToken != null) as ZoomOAuthAccessTokenCacheServiceWithRefreshToken[];

  const cacheForRefreshToken =
    allServiceAccessTokenCaches.length > 0
      ? (refreshToken: string): ZoomAccessTokenCache => {
          const allCaches = allServicesWithCacheForRefreshToken.map((x) => x.cacheForRefreshToken(refreshToken));
          return loadZoomAccessTokenCache(allCaches);
        }
      : undefined;

  const service: ZoomOAuthAccessTokenCacheService = {
    loadZoomAccessTokenCache: () => loadZoomAccessTokenCache(allServiceAccessTokenCaches),
    cacheForRefreshToken
  };

  return service;
}

// MARK: Memory Access Token Cache
/**
 * Creates a ZoomOAuthAccessTokenCacheService that uses in-memory storage.
 *
 * @returns
 */
export function memoryZoomOAuthAccessTokenCacheService(existingToken?: Maybe<ZoomAccessToken>): ZoomOAuthAccessTokenCacheService {
  let token: Maybe<ZoomAccessToken> = existingToken;

  function loadZoomAccessTokenCache(): ZoomAccessTokenCache {
    const accessTokenCache: ZoomAccessTokenCache = {
      loadCachedToken: async function (): Promise<Maybe<ZoomAccessToken>> {
        console.log('retrieving access token from memory: ', { token });
        return token;
      },
      updateCachedToken: async function (accessToken: ZoomAccessToken): Promise<void> {
        token = accessToken;
        console.log('updating access token in memory: ', { accessToken });
      }
    };

    return accessTokenCache;
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
 * Creates a ZoomOAuthAccessTokenCacheService that reads and writes the access token to the file system.
 *
 * Useful for testing.
 *
 * @returns
 */
export function fileZoomOAuthAccessTokenCacheService(filename: string = DEFAULT_FILE_ZOOM_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH, useMemoryCache = true): FileSystemZoomOAuthAccessTokenCacheService {
  let loadedToken: Maybe<ZoomOAuthAccessTokenCacheFileContent> = null;

  async function loadTokenFile(): Promise<ZoomOAuthAccessTokenCacheFileContent> {
    let token: Maybe<ZoomOAuthAccessTokenCacheFileContent> = undefined;

    if (!loadedToken) {
      token = (await readTokenFile()) ?? {};
    } else {
      token = loadedToken;
    }

    return token;
  }

  function readTokenFile(): Promise<Maybe<ZoomOAuthAccessTokenCacheFileContent>> {
    return new Promise<Maybe<ZoomOAuthAccessTokenCacheFileContent>>((resolve) => {
      mkdirSync(dirname(filename), { recursive: true }); // make the directory first
      readFile(filename, {}, (x, data) => {
        let result: Maybe<ZoomOAuthAccessTokenCacheFileContent> = undefined;

        if (!x) {
          try {
            result = JSON.parse(data.toString());

            if (result?.token) {
              (result.token as Configurable<ZoomAccessToken>).expiresAt = new Date(result.token.expiresAt);
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

  async function writeTokenFile(tokens: ZoomOAuthAccessTokenCacheFileContent): Promise<void> {
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

  function loadZoomAccessTokenCache(): ZoomAccessTokenCache {
    const accessTokenCache: ZoomAccessTokenCache = {
      loadCachedToken: async function (): Promise<Maybe<ZoomAccessToken>> {
        const tokens = await loadTokenFile();
        const token = tokens.token;
        console.log('retrieving access token from file: ', { token });
        return token;
      },
      updateCachedToken: async function (accessToken: ZoomAccessToken): Promise<void> {
        const tokenFile = await loadTokenFile();

        if (tokenFile) {
          (tokenFile as Configurable<ZoomOAuthAccessTokenCacheFileContent>).token = accessToken;
        }

        console.log('updating access token in file: ', { accessToken });

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
    loadZoomAccessTokenCache,
    readTokenFile,
    writeTokenFile,
    deleteTokenFile
  };
}
