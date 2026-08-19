import { type AsyncKeyedValueCache, type Maybe, expirationDetails } from '@dereekb/util';
import { createMemoizedJsonFileAsyncKeyedValueCache } from '@dereekb/nestjs';
import { type CliFirestoreSession } from '../api/firestore-session.client';

/**
 * Hard ceiling on how long a minted direct-Firestore session may be reused, regardless of what the
 * API reported in `expiresAt`.
 *
 * One hour, because that is the Firebase ceiling the credentials themselves sit under: a custom
 * token is exchangeable for one hour, and the ID token it mints lives one hour. Holding a session
 * past that buys nothing — the sign-in would fail — and re-minting is one HTTP round-trip.
 */
export const CLI_FIRESTORE_SESSION_MAX_CACHE_MS = 60 * 60 * 1000;

/**
 * Default skew/latency buffer applied when deciding whether a cached session is still usable.
 */
export const CLI_FIRESTORE_SESSION_EXPIRY_BUFFER_MS = 60_000;

/**
 * A cached direct-Firestore session for a single env.
 *
 * Stores the credential envelope the API minted, not the live Firebase objects — those are
 * per-process and cannot be serialized. A cache hit still signs in; it just skips the
 * `GET /session/firestore` round-trip.
 */
export interface CliFirestoreSessionEntry {
  /**
   * The credential bundle returned by `GET /session/firestore`.
   */
  readonly session: CliFirestoreSession;
  /**
   * Unix epoch milliseconds at which the entry was written.
   */
  readonly cachedAt: number;
  /**
   * The uid the entry was minted for, denormalized so a stale entry belonging to a different user
   * can be detected without parsing the custom token.
   */
  readonly uid: string;
}

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
export type CliFirestoreSessionCacheStore = AsyncKeyedValueCache<CliFirestoreSessionEntry>;

export interface CreateCliFirestoreSessionCacheStoreInput {
  readonly firestoreSessionCachePath: string;
}

/**
 * Creates a per-env direct-Firestore session cache store backed by a single JSON file.
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
 * Resolves the epoch-millis instant at which a cached session stops being usable.
 *
 * The effective expiry is the EARLIER of the API-reported `expiresAt` and
 * {@link CLI_FIRESTORE_SESSION_MAX_CACHE_MS} past the write. Taking the earlier of the two means a
 * server that reports an over-long (or unparsable) window still cannot push a session past the
 * Firebase credential ceiling.
 *
 * @param entry - The cached entry.
 * @returns The effective expiry in unix epoch milliseconds.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliFirestoreSessionEntryExpiresAt(entry: CliFirestoreSessionEntry): number {
  const ceiling = entry.cachedAt + CLI_FIRESTORE_SESSION_MAX_CACHE_MS;
  const reported = Date.parse(entry.session.expiresAt);
  return Number.isFinite(reported) ? Math.min(reported, ceiling) : ceiling;
}

/**
 * Returns true when the cached session is at or near its effective expiry.
 *
 * @param entry - The cached entry (`null`/`undefined` is treated as expired).
 * @param nowMs - The current time in unix epoch milliseconds. Defaults to `Date.now()`.
 * @param bufferMs - Skew/latency buffer; the entry is treated as expired this far ahead of its effective expiry.
 * @returns `true` when the entry is unusable, otherwise `false`.
 */
export function isCliFirestoreSessionExpired(entry: Maybe<CliFirestoreSessionEntry>, nowMs: number = Date.now(), bufferMs: number = CLI_FIRESTORE_SESSION_EXPIRY_BUFFER_MS): boolean {
  return entry == null || expirationDetails({ expiresFromDate: cliFirestoreSessionEntryExpiresAt(entry), expiresIn: -bufferMs, now: new Date(nowMs) }).hasExpired();
}
