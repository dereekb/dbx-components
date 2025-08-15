import { Injectable } from '@nestjs/common';
import { ZohoAccessToken, ZohoAccessTokenCache, ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { Maybe, forEachKeyValue, Configurable, filterMaybeArrayValues, tryWithPromiseFactoriesFunction, isPast } from '@dereekb/util';
import { dirname } from 'path';
import { readFile, writeFile, rm, mkdirSync } from 'fs';

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

export function logMergeZohoAccountsAccessTokenCacheServiceErrorFunction(failedUpdates: (readonly [ZohoAccessTokenCache, unknown])[]) {
  console.warn(`mergeZohoAccountsAccessTokenCacheServices(): failed updating ${failedUpdates.length} caches.`);
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
export function mergeZohoAccountsAccessTokenCacheServices(inputServicesToMerge: ZohoAccountsAccessTokenCacheService[], logError?: Maybe<boolean | LogMergeZohoAccountsAccessTokenCacheServiceErrorFunction>): ZohoAccountsAccessTokenCacheService {
  const services = [...inputServicesToMerge];
  const logErrorFunction = typeof logError === 'function' ? logError : logError !== false ? logMergeZohoAccountsAccessTokenCacheServiceErrorFunction : undefined;

  if (services.length === 0) {
    throw new Error('mergeZohoAccountsAccessTokenCacheServices() input cannot be empty.');
  }

  const service: ZohoAccountsAccessTokenCacheService = {
    loadZohoAccessTokenCache: function (service: string): ZohoAccessTokenCache {
      const accessCachesForServices = services.map((x) => x.loadZohoAccessTokenCache(service));
      const loadCachedTokenFromFirstService = tryWithPromiseFactoriesFunction<void, ZohoAccessToken>({
        promiseFactories: accessCachesForServices.map(
          (x) => () =>
            x
              .loadCachedToken()
              .catch(() => null)
              .then((x) => {
                let result: Maybe<ZohoAccessToken> = undefined;

                if (x && !isPast(x.expiresAt)) {
                  result = x; // only return from cache if it is not expired
                }

                return result;
              })
        ),
        successOnMaybe: false,
        throwErrors: false
      });

      const cacheForService: ZohoAccessTokenCache = {
        loadCachedToken: function (): Promise<Maybe<ZohoAccessToken>> {
          return loadCachedTokenFromFirstService();
        },
        updateCachedToken: async function (accessToken: ZohoAccessToken): Promise<void> {
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
              const failedUpdates = filterMaybeArrayValues(x.map((y) => (y as PromiseFulfilledResult<any>).value)) as unknown as (readonly [ZohoAccessTokenCache, unknown])[];

              if (failedUpdates.length) {
                logErrorFunction(failedUpdates);
              }
            }
          });
        },
        clearCachedToken: async function () {
          await Promise.allSettled(accessCachesForServices.map((x) => x.clearCachedToken()));
        }
      };

      return cacheForService;
    }
  };

  return service;
}

// MARK: Memory Access Token Cache
/**
 * Creates a ZohoAccountsAccessTokenCacheService that uses in-memory storage.
 *
 * @returns
 */
export function memoryZohoAccountsAccessTokenCacheService(existingCache?: ZohoAccountsAccessTokenCacheRecord, logAccessToConsole?: boolean): ZohoAccountsAccessTokenCacheService {
  const tokens: ZohoAccountsAccessTokenCacheRecord = existingCache ?? {};

  function loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache {
    const accessTokenCache: ZohoAccessTokenCache = {
      loadCachedToken: async function (): Promise<Maybe<ZohoAccessToken>> {
        const token = tokens[service];

        if (logAccessToConsole) {
          console.log('retrieving access token from memory: ', { token, service });
        }
        return token;
      },
      updateCachedToken: async function (accessToken: ZohoAccessToken): Promise<void> {
        tokens[service] = accessToken;
        if (logAccessToConsole) {
          console.log('updating access token in memory: ', { accessToken, service });
        }
      },
      clearCachedToken: async function (): Promise<void> {
        delete tokens[service];

        if (logAccessToConsole) {
          console.log('clearing access token in memory: ', { service });
        }
      }
    };

    return accessTokenCache;
  }

  return {
    loadZohoAccessTokenCache
  };
}

export interface FileSystemZohoAccountsAccessTokenCacheService extends ZohoAccountsAccessTokenCacheService {
  readTokenFile(): Promise<Maybe<ZohoAccountsAccessTokenCacheRecord>>;
  writeTokenFile(tokens: ZohoAccountsAccessTokenCacheRecord): Promise<void>;
  deleteTokenFile(): Promise<void>;
}

// MARK: File System Access Token Cache
export const DEFAULT_FILE_ZOHO_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH = '.tmp/zoho-access-tokens.json';

/**
 * Creates a ZohoAccountsAccessTokenCacheService that reads and writes the access token to the file system.
 *
 * Useful for testing.
 *
 * @returns
 */
export function fileZohoAccountsAccessTokenCacheService(filename: string = DEFAULT_FILE_ZOHO_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH, useMemoryCache = true): FileSystemZohoAccountsAccessTokenCacheService {
  let loadedTokens: Maybe<ZohoAccountsAccessTokenCacheRecord> = null;

  async function loadTokens(): Promise<ZohoAccountsAccessTokenCacheRecord> {
    if (!loadedTokens) {
      return (await readTokenFile()) ?? {};
    } else {
      return loadedTokens;
    }
  }

  function readTokenFile(): Promise<Maybe<ZohoAccountsAccessTokenCacheRecord>> {
    return new Promise<Maybe<ZohoAccountsAccessTokenCacheRecord>>((resolve) => {
      mkdirSync(dirname(filename), { recursive: true }); // make the directory first
      readFile(filename, {}, (x, data) => {
        let result: Maybe<ZohoAccountsAccessTokenCacheRecord> = undefined;

        if (!x) {
          try {
            result = JSON.parse(data.toString());
            forEachKeyValue(result as ZohoAccountsAccessTokenCacheRecord, {
              forEach: (x) => {
                if (x[1]) {
                  (x[1] as Configurable<ZohoAccessToken>).expiresAt = new Date(x[1].expiresAt);
                }
              }
            });
          } catch (e) {
            console.error('Failed reading token file: ', e);
          }
        }

        resolve(result);
      });
    }).then((x) => {
      // update loaded tokens
      if (useMemoryCache) {
        loadedTokens = {
          ...loadedTokens,
          ...x
        };
      }

      return x;
    });
  }

  async function writeTokenFile(tokens: ZohoAccountsAccessTokenCacheRecord): Promise<void> {
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

  function loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache {
    const accessTokenCache: ZohoAccessTokenCache = {
      loadCachedToken: async function (): Promise<Maybe<ZohoAccessToken>> {
        const tokens = await loadTokens();
        const token = tokens[service];
        // console.log('retrieving access token from file: ', { token, service });
        return token;
      },
      updateCachedToken: async function (accessToken: ZohoAccessToken): Promise<void> {
        const tokens = await loadTokens();

        if (tokens) {
          tokens[service] = accessToken;
        }

        // console.log('updating access token in file: ', { accessToken, service });

        try {
          await writeTokenFile(tokens);
        } catch (e) {
          console.error('Failed updating access token in file: ', e);
        }
      },
      clearCachedToken: async function (): Promise<void> {
        try {
          await writeTokenFile({});
        } catch (e) {
          console.error('Failed clearing access token in file: ', e);
        }
      }
    };

    return accessTokenCache;
  }

  return {
    loadZohoAccessTokenCache,
    readTokenFile,
    writeTokenFile,
    deleteTokenFile
  };
}
