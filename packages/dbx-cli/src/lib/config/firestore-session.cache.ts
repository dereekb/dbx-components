import { createMemoizedJsonFileAsyncKeyedValueCache } from '@dereekb/nestjs';
import { FIRESTORE_SESSION_EXPIRY_BUFFER_MS, FIRESTORE_SESSION_MAX_CACHE_MS, type FirestoreSessionCacheEntry, type FirestoreSessionCredentialsCache, firestoreSessionEntryExpiresAt, isFirestoreSessionExpired } from '@dereekb/oauth-resource/firebase';

/**
 * Hard ceiling on how long a minted direct-Firestore session may be reused, regardless of what the
 * API reported in `expiresAt`. See {@link FIRESTORE_SESSION_MAX_CACHE_MS}.
 */
export const CLI_FIRESTORE_SESSION_MAX_CACHE_MS = FIRESTORE_SESSION_MAX_CACHE_MS;

/**
 * Default skew/latency buffer applied when deciding whether a cached session is still usable. See
 * {@link FIRESTORE_SESSION_EXPIRY_BUFFER_MS}.
 */
export const CLI_FIRESTORE_SESSION_EXPIRY_BUFFER_MS = FIRESTORE_SESSION_EXPIRY_BUFFER_MS;

/**
 * A cached direct-Firestore session for a single env. The CLI's name for
 * {@link FirestoreSessionCacheEntry}.
 */
export type CliFirestoreSessionEntry = FirestoreSessionCacheEntry;

/**
 * Firestore session cache shape on disk — keyed by env name.
 */
export type CliFirestoreSessionCache = Record<string, CliFirestoreSessionEntry>;

/**
 * Session cache store keyed by env name.
 *
 * Backed by a single JSON file with per-process in-memory memoization, exactly like the token
 * cache — see {@link createMemoizedJsonFileAsyncKeyedValueCache}.
 */
export type CliFirestoreSessionCacheStore = FirestoreSessionCredentialsCache;

export interface CreateCliFirestoreSessionCacheStoreInput {
  readonly firestoreSessionCachePath: string;
}

/**
 * Creates a per-env direct-Firestore session cache store backed by a single JSON file.
 *
 * The file-backed half of the session cache stays HERE rather than moving to
 * `@dereekb/oauth-resource/firebase`: it depends on `@dereekb/nestjs`, and a Nest peer has no business
 * in a package whose whole point is a clean install graph. Only the expiry policy and the
 * {@link FirestoreSessionCredentialsCache} port are shared.
 *
 * Entries are written with mode 0o600 — they hold a Firebase custom token, which is a bearer
 * credential for the user it was minted for.
 *
 * @param input - The cache store inputs.
 * @param input.firestoreSessionCachePath - Absolute path to the JSON file backing the cache.
 * @returns A {@link CliFirestoreSessionCacheStore} keyed by env name.
 * @__NO_SIDE_EFFECTS__
 */
export function createCliFirestoreSessionCacheStore(input: CreateCliFirestoreSessionCacheStoreInput): CliFirestoreSessionCacheStore {
  return createMemoizedJsonFileAsyncKeyedValueCache<CliFirestoreSessionEntry>({
    filePath: input.firestoreSessionCachePath
  });
}

/**
 * Resolves the epoch-millis instant at which a cached session stops being usable. See
 * {@link firestoreSessionEntryExpiresAt}.
 */
export const cliFirestoreSessionEntryExpiresAt = firestoreSessionEntryExpiresAt;

/**
 * Returns true when the cached session is at or near its effective expiry. See
 * {@link isFirestoreSessionExpired}.
 */
export const isCliFirestoreSessionExpired = isFirestoreSessionExpired;
