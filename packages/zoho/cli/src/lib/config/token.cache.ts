import { type ZohoAccessToken, type ZohoAccessTokenCache } from '@dereekb/zoho';
import { createMemoizedJsonFileAsyncValueCache } from '@dereekb/nestjs';

/**
 * Creates a {@link ZohoAccessTokenCache} backed by a single JSON file with per-process memoization.
 *
 * Revives `expiresAt` to a `Date` after JSON parse so consumers receive a typed token regardless
 * of how the value was serialized.
 */
export function createFileTokenCache(filePath: string): ZohoAccessTokenCache {
  const inner = createMemoizedJsonFileAsyncValueCache<ZohoAccessToken>({
    filePath,
    reviver: (raw) => {
      if (raw == null || typeof raw !== 'object') {
        return undefined;
      }
      const value = raw as Partial<ZohoAccessToken> & { expiresAt?: unknown };

      // Validate the required ZohoAccessToken shape so a corrupt or partial file is treated
      // as a cache miss rather than re-emitted as a malformed token.
      if (typeof value.accessToken !== 'string' || typeof value.scope !== 'string' || typeof value.apiDomain !== 'string' || typeof value.expiresIn !== 'number') {
        return undefined;
      }

      const rawExpiresAt = value.expiresAt;
      const expiresAt = rawExpiresAt instanceof Date ? rawExpiresAt : rawExpiresAt != null ? new Date(rawExpiresAt as string | number) : undefined;

      if (expiresAt == null || Number.isNaN(expiresAt.getTime())) {
        return undefined;
      }

      return { ...(value as ZohoAccessToken), expiresAt };
    }
  });

  return {
    loadCachedToken: () => inner.load(),
    updateCachedToken: (token) => inner.update(token),
    clearCachedToken: () => inner.clear()
  };
}
