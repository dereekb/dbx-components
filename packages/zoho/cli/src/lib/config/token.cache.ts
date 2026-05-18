import { type ZohoAccessToken, type ZohoAccessTokenCache } from '@dereekb/zoho';
import { createMemoizedJsonFileAsyncValueCache } from '@dereekb/nestjs';

/**
 * Creates a {@link ZohoAccessTokenCache} backed by a single JSON file with per-process memoization.
 *
 * Revives `expiresAt` to a `Date` after JSON parse so consumers receive a typed token regardless
 * of how the value was serialized. A corrupt or partial cache file (missing required fields, non-finite `expiresIn`, or unparseable `expiresAt`) is treated as a cache miss rather than re-emitted.
 *
 * @param filePath - Absolute filesystem path of the JSON file used to persist the cached access token.
 * @returns A {@link ZohoAccessTokenCache} adapter that delegates load/update/clear to the underlying memoized JSON file cache.
 */
export function createFileTokenCache(filePath: string): ZohoAccessTokenCache {
  const inner = createMemoizedJsonFileAsyncValueCache<ZohoAccessToken>({
    filePath,
    reviver: (raw) => {
      let result: ZohoAccessToken | undefined;

      if (raw == null || typeof raw !== 'object') {
        result = undefined;
      } else {
        const value = raw as Partial<ZohoAccessToken> & { expiresAt?: unknown };

        // Validate the required ZohoAccessToken shape so a corrupt or partial file is treated
        // as a cache miss rather than re-emitted as a malformed token. expiresIn must be a
        // finite positive number — NaN, ±Infinity, and zero/negative durations are nonsense
        // for a TTL and should fail validation.
        if (typeof value.accessToken !== 'string' || typeof value.scope !== 'string' || typeof value.apiDomain !== 'string' || typeof value.expiresIn !== 'number' || !Number.isFinite(value.expiresIn) || value.expiresIn <= 0) {
          result = undefined;
        } else {
          const rawExpiresAt = value.expiresAt;
          let expiresAt: Date | undefined;
          if (rawExpiresAt instanceof Date) {
            expiresAt = rawExpiresAt;
          } else if (rawExpiresAt == null) {
            expiresAt = undefined;
          } else {
            expiresAt = new Date(rawExpiresAt);
          }

          if (expiresAt == null || Number.isNaN(expiresAt.getTime())) {
            result = undefined;
          } else {
            result = { ...(value as ZohoAccessToken), expiresAt };
          }
        }
      }

      return result;
    }
  });

  return {
    loadCachedToken: () => inner.load(),
    updateCachedToken: (token) => inner.update(token),
    clearCachedToken: () => inner.clear()
  };
}
