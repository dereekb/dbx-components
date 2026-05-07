import { type AsyncKeyedValueCache, type Maybe, expirationDetails } from '@dereekb/util';
import { createMemoizedJsonFileAsyncKeyedValueCache } from '@dereekb/nestjs';

/**
 * A cached token entry for a single env.
 */
export interface CliTokenEntry {
  readonly accessToken: string;
  readonly refreshToken?: string;
  /**
   * Unix epoch milliseconds at which the access token expires.
   */
  readonly expiresAt: number;
  readonly tokenType?: string;
  readonly scope?: string;
  readonly idToken?: string;
}

/**
 * Token cache shape on disk — keyed by env name.
 */
export type CliTokenCache = Record<string, CliTokenEntry>;

/**
 * Token cache store keyed by env name.
 *
 * Backed by a single JSON file with per-process in-memory memoization. See
 * {@link createMemoizedJsonFileAsyncKeyedValueCache} for the underlying file/memo behavior.
 */
export type CliTokenCacheStore = AsyncKeyedValueCache<CliTokenEntry>;

export interface CreateCliTokenCacheStoreInput {
  readonly tokenCachePath: string;
}

/**
 * Creates a per-env token cache store backed by a single JSON file.
 *
 * Entries are written with mode 0o600. Reads are memoized per-process to avoid hitting disk
 * on every access.
 *
 * @param input - The cache store inputs.
 * @param input.tokenCachePath - Absolute path to the JSON file backing the cache.
 * @returns A {@link CliTokenCacheStore} keyed by env name.
 */
export function createCliTokenCacheStore(input: CreateCliTokenCacheStoreInput): CliTokenCacheStore {
  return createMemoizedJsonFileAsyncKeyedValueCache<CliTokenEntry>({
    filePath: input.tokenCachePath
  });
}

/**
 * Returns true when the token entry's access token is at or near expiry.
 *
 * Defaults to a 60-second buffer to allow for clock skew and request latency.
 *
 * @param entry - The token cache entry to check (`null`/`undefined` is treated as expired).
 * @param nowMs - The current time in unix epoch milliseconds. Defaults to `Date.now()`.
 * @param bufferMs - Skew/latency buffer in milliseconds; the token is treated as expired this far ahead of `expiresAt`.
 * @returns `true` when the token is at or within `bufferMs` of expiry, otherwise `false`.
 */
export function isTokenExpired(entry: Maybe<CliTokenEntry>, nowMs: number = Date.now(), bufferMs: number = 60_000): boolean {
  return expirationDetails({ expiresFromDate: entry?.expiresAt, expiresIn: -bufferMs, now: new Date(nowMs) }).hasExpired();
}
