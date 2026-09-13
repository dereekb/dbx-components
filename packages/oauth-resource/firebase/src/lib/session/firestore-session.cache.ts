import { type AsyncKeyedValueCache, type Maybe, type Milliseconds, type UnixDateTimeMillisecondsNumber, expirationDetails } from '@dereekb/util';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { type FirestoreSessionCredentials } from './firestore-session.client';

/**
 * Hard ceiling on how long a minted user-scoped Firestore session may be reused, regardless of what
 * the API reported in `expiresAt`.
 *
 * One hour, because that is the Firebase ceiling the credentials themselves sit under: a custom
 * token is exchangeable for one hour, and the ID token it mints lives one hour. Holding a session
 * past that buys nothing — the sign-in would fail — and re-minting is one HTTP round-trip.
 */
export const FIRESTORE_SESSION_MAX_CACHE_MS: Milliseconds = 60 * 60 * 1000;

/**
 * Default skew/latency buffer applied when deciding whether a cached session is still usable.
 */
export const FIRESTORE_SESSION_EXPIRY_BUFFER_MS: Milliseconds = 60_000;

/**
 * A cached user-scoped Firestore session.
 *
 * Stores the credential envelope the API minted, not the live Firebase objects — those are
 * per-process and cannot be serialized. A cache hit still signs in; it just skips the
 * `GET /session/firestore` round-trip.
 *
 * SECURITY: every entry holds a Firebase custom token, which is a bearer credential for the user it
 * was minted for. A persistent store MUST protect them at least as well as a 0600 file — this
 * package deliberately ships no persistent implementation, only the {@link FirestoreSessionCredentialsCache}
 * port and the expiry policy; `firebaseUserSessionPool`'s own state is in-memory and dies with the
 * process.
 */
export interface FirestoreSessionCacheEntry {
  /**
   * The credential bundle returned by `GET /session/firestore`.
   *
   * Named `session` rather than `credentials` deliberately: it is the on-disk JSON schema of every
   * existing `@dereekb/dbx-cli` `~/.<cli>/.firestore-sessions.json`, and renaming it would silently
   * invalidate every user's cache on upgrade.
   */
  readonly session: FirestoreSessionCredentials;
  /**
   * Unix epoch milliseconds at which the entry was written.
   */
  readonly cachedAt: UnixDateTimeMillisecondsNumber;
  /**
   * The uid the entry was minted for, denormalized so a stale entry belonging to a different user
   * can be detected without parsing the custom token.
   */
  readonly uid: FirebaseAuthUserId;
}

/**
 * A credentials cache keyed by whatever the consumer keys sessions on (an env name for a CLI, a uid
 * for a server).
 *
 * A PORT, not an implementation. This package ships no persistent store — see the security note on
 * {@link FirestoreSessionCacheEntry}.
 */
export type FirestoreSessionCredentialsCache = AsyncKeyedValueCache<FirestoreSessionCacheEntry>;

/**
 * Resolves the epoch-millis instant at which a cached session stops being usable.
 *
 * The effective expiry is the EARLIER of the API-reported `expiresAt` and
 * {@link FIRESTORE_SESSION_MAX_CACHE_MS} past the write. Taking the earlier of the two means a
 * server that reports an over-long (or unparsable) window still cannot push a session past the
 * Firebase credential ceiling.
 *
 * @param entry - The cached entry.
 * @returns The effective expiry in unix epoch milliseconds.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function firestoreSessionEntryExpiresAt(entry: FirestoreSessionCacheEntry): UnixDateTimeMillisecondsNumber {
  const ceiling = entry.cachedAt + FIRESTORE_SESSION_MAX_CACHE_MS;
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
export function isFirestoreSessionExpired(entry: Maybe<FirestoreSessionCacheEntry>, nowMs: UnixDateTimeMillisecondsNumber = Date.now(), bufferMs: Milliseconds = FIRESTORE_SESSION_EXPIRY_BUFFER_MS): boolean {
  return entry == null || expirationDetails({ expiresFromDate: firestoreSessionEntryExpiresAt(entry), expiresIn: -bufferMs, now: new Date(nowMs) }).hasExpired();
}
