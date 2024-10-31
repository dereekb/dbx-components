import { Injectable } from '@nestjs/common';
import { ZohoAccessToken, ZohoAccessTokenCache, ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { Maybe, GetterOrValue, forEachKeyValue, Configurable } from '@dereekb/util';
import { dirname } from 'path';
import { mkdir, readFile, writeFile, rm, mkdirSync } from 'fs';

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

// MARK: Memory Access Token Cache
/**
 * Creates a ZohoAccountsAccessTokenCacheService that uses in-memory storage.
 *
 * @returns
 */
export function memoryZohoAccountsAccessTokenCacheService(existingCache?: ZohoAccountsAccessTokenCacheRecord): ZohoAccountsAccessTokenCacheService {
  const tokens: ZohoAccountsAccessTokenCacheRecord = existingCache ?? {};

  function loadZohoAccessTokenCache(service: ZohoServiceAccessTokenKey): ZohoAccessTokenCache {
    const accessTokenCache: ZohoAccessTokenCache = {
      loadCachedToken: async function (): Promise<Maybe<ZohoAccessToken>> {
        const token = tokens[service];
        console.log('retrieving access token from memory: ', { token, service });
        return token;
      },
      updateCachedToken: async function (accessToken: ZohoAccessToken): Promise<void> {
        tokens[service] = accessToken;
        console.log('updating access token in memory: ', { accessToken, service });
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
