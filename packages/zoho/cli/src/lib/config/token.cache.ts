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
      const value = raw as ZohoAccessToken & { expiresAt?: unknown };
      const expiresAt = value.expiresAt != null && !(value.expiresAt instanceof Date) ? new Date(value.expiresAt as string | number) : (value.expiresAt as Date | undefined);
      return { ...(value as ZohoAccessToken), expiresAt: expiresAt as Date };
    }
  });

  return {
    loadCachedToken: () => inner.load(),
    updateCachedToken: (token) => inner.update(token),
    clearCachedToken: () => inner.clear()
  };
}
