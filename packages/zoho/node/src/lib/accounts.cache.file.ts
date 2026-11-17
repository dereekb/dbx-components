import { type ZohoAccessToken, type ZohoAccessTokenCache, type ZohoAccountsAccessTokenCacheRecord, type ZohoAccountsAccessTokenCacheService, type ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { type Maybe, memoizeAsyncKeyedValueCache } from '@dereekb/util';
import { createJsonFileAsyncKeyedValueCache, readJsonFile } from '@dereekb/nestjs';

/**
 * A {@link ZohoAccountsAccessTokenCacheService} that persists its tokens to a JSON file and can read, rewrite or delete that file directly.
 */
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
 *
 * @param raw - The raw value loaded from storage; expected to be an object shaped like a ZohoAccessToken with a serialized `expiresAt`
 * @returns The parsed ZohoAccessToken with `expiresAt` coerced to a Date, or undefined when the input is not an object.
 */
function reviveZohoAccessToken(raw: unknown): Maybe<ZohoAccessToken> {
  let result: Maybe<ZohoAccessToken>;

  if (raw == null || typeof raw !== 'object') {
    result = undefined;
  } else {
    const value = raw as ZohoAccessToken & { expiresAt?: unknown };
    const rawExpiresAt = value.expiresAt;
    const expiresAt = rawExpiresAt != null && !(rawExpiresAt instanceof Date) ? new Date(rawExpiresAt) : rawExpiresAt;

    result = { ...value, expiresAt: expiresAt };
  }

  return result;
}

/**
 * Creates a ZohoAccountsAccessTokenCacheService that reads and writes the access token to the file system.
 *
 * Composes {@link createJsonFileAsyncKeyedValueCache} (for the on-disk record) optionally with
 * {@link memoizeAsyncKeyedValueCache} so reads after the first hit memory.
 *
 * Useful for testing.
 *
 * @param filename - Path to the JSON file used for token persistence.
 * @param useMemoryCache - Whether to also cache tokens in memory for faster reads.
 * @returns A FileSystemZohoAccountsAccessTokenCacheService backed by file storage.
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
    let result: Maybe<ZohoAccountsAccessTokenCacheRecord>;

    if (raw == null) {
      result = undefined;
    } else {
      const revived: ZohoAccountsAccessTokenCacheRecord = {};
      for (const key of Object.keys(raw)) {
        revived[key] = reviveZohoAccessToken(raw[key]);
      }
      result = revived;
    }

    return result;
  }

  // Route the file-mutation helpers through the same `cache` instance used by
  // loadZohoAccessTokenCache so the memoized in-memory layer (when useMemoryCache=true) stays
  // consistent with disk. Direct writeJsonFile / removeFile would otherwise leave the memo
  // holding stale entries that no future read could refresh.
  async function writeTokenFile(tokens: ZohoAccountsAccessTokenCacheRecord): Promise<void> {
    await cache.clear();

    for (const [key, value] of Object.entries(tokens)) {
      if (value != null) {
        await cache.set(key, value);
      }
    }
  }

  async function deleteTokenFile(): Promise<void> {
    await cache.clear();
  }

  return {
    loadZohoAccessTokenCache,
    readTokenFile,
    writeTokenFile,
    deleteTokenFile
  };
}
