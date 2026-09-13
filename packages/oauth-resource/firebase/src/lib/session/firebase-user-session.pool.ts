import { deleteApp } from 'firebase/app';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { type Getter, type Maybe, type Milliseconds, type UnixDateTimeMillisecondsNumber, type WebsiteUrl } from '@dereekb/util';
import { type FirebaseClientConfig } from './firebase-client.config';
import { type FirestoreSessionErrorFactory, defaultFirestoreSessionErrorFactory } from './firestore-session.client';
import { FIRESTORE_SESSION_EXPIRY_BUFFER_MS, FIRESTORE_SESSION_MAX_CACHE_MS, type FirestoreSessionCredentialsCache } from './firestore-session.cache';
import { type FirebaseUserSession, type FirebaseUserSessionOpener, firebaseUserSessionAppName, openFirebaseUserSession } from './firebase-user-session';

/**
 * Default {@link FirebaseUserSessionPoolConfig.maxSessions}.
 *
 * Bounds *concurrently distinct users*, not total users. Each entry is a full Firebase app: one
 * `Firestore` with its network stack and one `Auth` with a refresh timer. 32 is deliberate — high
 * enough that a normal request mix never evicts, low enough that an unbounded-uid caller cannot
 * exhaust the process.
 */
export const DEFAULT_FIREBASE_USER_SESSION_POOL_SIZE = 32;

export interface FirebaseUserSessionPoolConfig {
  /**
   * The teardown-sweep key shared by every app this pool registers. Required — a silent default lets
   * two pools in one process collide.
   */
  readonly namespace: string;
  readonly firebase: FirebaseClientConfig;
  readonly apiBaseUrl: WebsiteUrl;
  /**
   * Discriminates sessions that share a uid but not a target. Defaults to `firebase.projectId`.
   */
  readonly scope?: Maybe<string>;
  /**
   * Target number of concurrently-held sessions. Defaults to
   * {@link DEFAULT_FIREBASE_USER_SESSION_POOL_SIZE}.
   */
  readonly maxSessions?: Maybe<number>;
  /**
   * Hard ceiling on a session's usable age. Defaults to {@link FIRESTORE_SESSION_MAX_CACHE_MS}.
   */
  readonly maxSessionAgeMs?: Maybe<Milliseconds>;
  /**
   * How far ahead of a session's expiry it stops being handed out. Defaults to
   * {@link FIRESTORE_SESSION_EXPIRY_BUFFER_MS}.
   */
  readonly refreshSkewMs?: Maybe<Milliseconds>;
  readonly fetcher?: Maybe<typeof fetch>;
  readonly errorFactory?: Maybe<FirestoreSessionErrorFactory>;
  /**
   * Optional credentials cache shared across opens.
   *
   * SECURITY: a {@link FirestoreSessionCredentials} is a bearer credential for its user. The pool's
   * own state is in-memory and dies with the process; supply a cache only if you can protect it at
   * least as well as a 0600 file store.
   */
  readonly credentialsCache?: Maybe<FirestoreSessionCredentialsCache>;
  /**
   * Test seam. Defaults to {@link openFirebaseUserSession}.
   */
  readonly openSession?: Maybe<FirebaseUserSessionOpener>;
  /**
   * Clock seam, so TTL/LRU behavior is deterministic in specs.
   */
  readonly now?: Maybe<Getter<UnixDateTimeMillisecondsNumber>>;
  readonly onEvent?: Maybe<FirebaseUserSessionPoolEventHandler>;
}

/**
 * What happened to a pooled session.
 *
 * `evicted` / `expired` / `over-capacity` are DECISIONS; `closed` is the app actually going away,
 * which for an entry marked over-capacity happens later, on its last `release()`.
 */
export type FirebaseUserSessionPoolEventType = 'opened' | 'reused' | 'expired' | 'evicted' | 'over-capacity' | 'closed' | 'teardown-failed';

export interface FirebaseUserSessionPoolEvent {
  readonly type: FirebaseUserSessionPoolEventType;
  readonly uid: FirebaseAuthUserId;
  readonly appName: string;
  /**
   * The pool's entry count after the event.
   */
  readonly size: number;
  readonly error?: unknown;
}

export type FirebaseUserSessionPoolEventHandler = (event: FirebaseUserSessionPoolEvent) => void;

export interface AcquireFirebaseUserSessionInput {
  readonly uid: FirebaseAuthUserId;
  /**
   * The verified bearer access token belonging to {@link uid}.
   */
  readonly accessToken: string;
  /**
   * Skips any credentials-cache read for this acquisition.
   */
  readonly refreshCredentials?: boolean;
}

/**
 * A borrowed session. The pool will not tear its app down while the lease is held.
 */
export interface FirebaseUserSessionLease {
  readonly session: FirebaseUserSession;
  /**
   * Returns the session to the pool. Idempotent.
   */
  release(): void;
}

export interface FirebaseUserSessionPoolStats {
  /**
   * Number of pooled entries.
   */
  readonly size: number;
  /**
   * Number of OUTSTANDING leases across all entries — not the number of leased entries.
   */
  readonly leased: number;
  readonly maxSessions: number;
}

export interface FirebaseUserSessionPool {
  /**
   * Borrows a session for the uid, opening one if needed.
   *
   * @param input - The uid and its access token.
   * @returns The lease. The caller MUST `release()` it.
   */
  openSession(input: AcquireFirebaseUserSessionInput): Promise<FirebaseUserSessionLease>;
  /**
   * Borrows a session for the duration of `fn` and releases it afterwards, however `fn` settles.
   *
   * The request boundary IS the lifetime, so this is what a resource server calls.
   *
   * @param input - The uid and its access token.
   * @param fn - The work to run with the session.
   * @returns Whatever `fn` resolves to.
   */
  useSession<T>(input: AcquireFirebaseUserSessionInput, fn: (session: FirebaseUserSession) => Promise<T>): Promise<T>;
  /**
   * Detaches and tears down the uid's session — immediately when idle, on its last `release()`
   * otherwise.
   *
   * @param uid - The user whose session should be closed.
   */
  closeSession(uid: FirebaseAuthUserId): Promise<void>;
  /**
   * Tears down every session and latches the pool closed. A later `openSession` throws `unavailable`.
   */
  close(): Promise<void>;
  stats(): FirebaseUserSessionPoolStats;
}

/**
 * One pooled `(scope, uid)` session and its lifecycle bookkeeping.
 */
interface FirebaseUserSessionPoolEntry {
  readonly key: string;
  readonly uid: FirebaseAuthUserId;
  /**
   * The derived base app name until the session resolves, then the session's actual name (which may
   * carry a `#n` suffix).
   */
  appName: string;
  leases: number;
  lastUsedAt: UnixDateTimeMillisecondsNumber;
  /**
   * The pool-enforced expiry, known only once {@link loading} resolves. An unresolved entry is never
   * treated as expired.
   */
  expiresAt?: UnixDateTimeMillisecondsNumber;
  /**
   * The in-flight (or settled) open. Storing the PROMISE is what makes two concurrent acquisitions
   * for one uid share a single open.
   */
  readonly loading: Promise<FirebaseUserSession>;
  /**
   * Set when the entry has been detached and must be torn down as soon as its last lease is
   * released.
   */
  pendingTeardown: boolean;
}

/**
 * Creates a per-`(scope, uid)` Firebase session pool with an explicit cap and TTL/LRU eviction.
 *
 * Exists because {@link openFirebaseUserSession} alone does not generalize past one user per process:
 * a signed-in `Auth` runs a token-refresh timer and a live `Firestore` holds handles, so a server
 * holding N concurrent user sessions leaks both per user without an owner. The pool is that owner.
 *
 * ### Why the TTL is driven by App Check, not Auth
 *
 * A signed-in `Auth` refreshes its ID token indefinitely — a Firebase refresh token does not expire
 * on an hourly clock. The App Check token does not refresh: it is minted once by the API and
 * `isTokenAutoRefreshEnabled` is `false`, because there is no local attestation to refresh against.
 * So the session's real ceiling is the envelope's `expiresAt` (documented by the endpoint as "the
 * earliest expiry among its credentials"), floored by {@link FirebaseUserSessionPoolConfig.maxSessionAgeMs}.
 * Tearing the whole app down on expiry and re-minting costs one round trip; keeping it alive costs a
 * silently unattested connection.
 *
 * ### Why a lease rather than a bare getter
 *
 * Reference counting is what makes eviction safe. Evicting an entry someone is mid-query on turns a
 * capacity event into a user-visible failure, so the pool never tears down a leased session.
 *
 * @param config - The pool configuration.
 * @returns The pool.
 */
export function firebaseUserSessionPool(config: FirebaseUserSessionPoolConfig): FirebaseUserSessionPool {
  const { namespace, firebase, apiBaseUrl, fetcher, credentialsCache } = config;
  const errorFactory = config.errorFactory ?? defaultFirestoreSessionErrorFactory;
  const openSessionImpl = config.openSession ?? openFirebaseUserSession;
  const now = config.now ?? (() => Date.now());
  const scope = config.scope || firebase.projectId || namespace;
  const maxSessions = config.maxSessions ?? DEFAULT_FIREBASE_USER_SESSION_POOL_SIZE;
  const maxSessionAgeMs = config.maxSessionAgeMs ?? FIRESTORE_SESSION_MAX_CACHE_MS;
  const refreshSkewMs = config.refreshSkewMs ?? FIRESTORE_SESSION_EXPIRY_BUFFER_MS;
  const onEvent = config.onEvent;

  const entries = new Map<string, FirebaseUserSessionPoolEntry>();
  let closed = false;

  function emit(type: FirebaseUserSessionPoolEventType, entry: FirebaseUserSessionPoolEntry, error?: unknown): void {
    onEvent?.({ type, uid: entry.uid, appName: entry.appName, size: entries.size, ...(error === undefined ? {} : { error }) });
  }

  /**
   * Removes the entry from the map when it is still the live one for its key.
   *
   * Guarded on identity because a replacement entry may already have been inserted for the same key
   * (the expiry path detaches and immediately re-opens), and deleting blindly would drop the new one.
   *
   * @param entry - The entry to remove.
   */
  function detach(entry: FirebaseUserSessionPoolEntry): void {
    if (entries.get(entry.key) === entry) {
      entries.delete(entry.key);
    }
  }

  async function teardown(entry: FirebaseUserSessionPoolEntry): Promise<void> {
    let session: Maybe<FirebaseUserSession>;

    try {
      session = await entry.loading;
    } catch {
      // an open that never produced a session has nothing to tear down; the rejection was already
      // surfaced to the caller that awaited it
      session = undefined;
    }

    if (session != null) {
      entry.appName = session.appName;

      try {
        // `deleteApp` directly rather than `closeFirebaseUserSession`, which deliberately swallows:
        // a long-lived pool wants a failed teardown OBSERVABLE — it means an app whose refresh timer
        // and network stack are still running — even though it must never be fatal.
        await deleteApp(session.app);
        emit('closed', entry);
      } catch (error) {
        emit('teardown-failed', entry, error);
      }
    }
  }

  /**
   * Tears the entry down now when it is idle, otherwise marks it for teardown on its last release.
   *
   * @param entry - The detached entry.
   * @returns The teardown promise when one started, otherwise `undefined`.
   */
  function teardownWhenIdle(entry: FirebaseUserSessionPoolEntry): Maybe<Promise<void>> {
    let result: Maybe<Promise<void>>;

    if (entry.leases === 0) {
      result = teardown(entry);
    } else {
      entry.pendingTeardown = true;
    }

    return result;
  }

  /**
   * Brings the pool back to its cap after an insert.
   *
   * The cap is a TARGET, not a hard ceiling. When every entry is leased there is nothing safe to
   * evict, so the pool admits anyway and marks the LRU entry for teardown-on-release: refusing a user
   * because other users are busy is worse than a brief overshoot, and killing a live handle is worse
   * than both. The overshoot is bounded by the host's own request concurrency.
   *
   * @param admitted - The entry just inserted, which is never the one given up.
   */
  function enforceCapacity(admitted: FirebaseUserSessionPoolEntry): void {
    while (entries.size > maxSessions) {
      const idle = leastRecentlyUsed((x) => x.leases === 0 && !x.pendingTeardown && x !== admitted);

      if (idle == null) {
        const lru = leastRecentlyUsed((x) => !x.pendingTeardown && x !== admitted);

        if (lru == null) {
          // every entry is leased AND already marked; there is nothing further to give up
          emit('over-capacity', admitted);
          break;
        } else {
          lru.pendingTeardown = true;
          detach(lru);
          emit('over-capacity', lru);
        }
      } else {
        detach(idle);
        emit('evicted', idle);
        void teardown(idle);
      }
    }
  }

  function leastRecentlyUsed(predicate: (entry: FirebaseUserSessionPoolEntry) => boolean): Maybe<FirebaseUserSessionPoolEntry> {
    let result: Maybe<FirebaseUserSessionPoolEntry>;

    entries.forEach((entry) => {
      if (predicate(entry) && (result == null || entry.lastUsedAt < result.lastUsedAt)) {
        result = entry;
      }
    });

    return result;
  }

  function openEntry(input: AcquireFirebaseUserSessionInput, key: string, openedAt: UnixDateTimeMillisecondsNumber): FirebaseUserSessionPoolEntry {
    const entry: FirebaseUserSessionPoolEntry = {
      key,
      uid: input.uid,
      appName: key,
      leases: 0,
      lastUsedAt: openedAt,
      pendingTeardown: false,
      loading: openSessionImpl({
        namespace,
        scope,
        firebase,
        apiBaseUrl,
        accessToken: input.accessToken,
        uid: input.uid,
        fetcher,
        errorFactory,
        credentialsCache,
        cacheKey: key,
        ...(input.refreshCredentials == null ? {} : { refreshCredentials: input.refreshCredentials }),
        maxSessionAgeMs,
        now
      })
    };

    entry.loading.then(
      (session) => {
        entry.appName = session.appName;
        // the ceiling is re-derived from the POOL's clock so it holds whatever the opener reported —
        // an envelope claiming a six-hour window is still capped at maxSessionAgeMs
        entry.expiresAt = Math.min(session.expiresAt, openedAt + maxSessionAgeMs);
      },
      () => {
        // Cache only on success: a rejected open is removed outright so the next acquisition retries
        // rather than latching onto the failure.
        detach(entry);
      }
    );

    return entry;
  }

  function isExpired(entry: FirebaseUserSessionPoolEntry, nowMs: UnixDateTimeMillisecondsNumber): boolean {
    return entry.expiresAt != null && entry.expiresAt - nowMs <= refreshSkewMs;
  }

  function leaseFor(entry: FirebaseUserSessionPoolEntry, session: FirebaseUserSession): FirebaseUserSessionLease {
    let released = false;

    return {
      session,
      release(): void {
        if (!released) {
          released = true;
          entry.leases -= 1;
          entry.lastUsedAt = now();

          if (entry.pendingTeardown && entry.leases === 0) {
            void teardown(entry);
          }
        }
      }
    };
  }

  async function acquire(input: AcquireFirebaseUserSessionInput): Promise<FirebaseUserSessionLease> {
    if (closed) {
      throw errorFactory({
        code: 'unavailable',
        message: 'The Firebase user session pool is closed.',
        suggestion: 'Do not reuse a pool after `close()`; build a new one.'
      });
    }

    const nowMs = now();
    const key = firebaseUserSessionAppName({ namespace, scope, uid: input.uid });
    const existing = entries.get(key);
    let entry: Maybe<FirebaseUserSessionPoolEntry>;

    if (existing != null && !existing.pendingTeardown && !isExpired(existing, nowMs)) {
      entry = existing;
      // leases + lastUsedAt are bumped SYNCHRONOUSLY, before any await, so a concurrent eviction
      // cannot tear down a session that is about to be handed out
      entry.leases += 1;
      entry.lastUsedAt = nowMs;
      emit('reused', entry);
    } else {
      if (existing != null) {
        detach(existing);
        emit('expired', existing);
        void teardownWhenIdle(existing);
      }

      entry = openEntry(input, key, nowMs);
      entry.leases += 1;
      entries.set(key, entry);
      emit('opened', entry);
      enforceCapacity(entry);
    }

    const acquired = entry;
    let session: FirebaseUserSession;

    try {
      session = await acquired.loading;
    } catch (e) {
      acquired.leases -= 1;
      throw e;
    }

    return leaseFor(acquired, session);
  }

  return {
    openSession: acquire,
    async useSession<T>(input: AcquireFirebaseUserSessionInput, fn: (session: FirebaseUserSession) => Promise<T>): Promise<T> {
      const lease = await acquire(input);

      try {
        return await fn(lease.session);
      } finally {
        lease.release();
      }
    },
    async closeSession(uid: FirebaseAuthUserId): Promise<void> {
      const entry = entries.get(firebaseUserSessionAppName({ namespace, scope, uid }));

      if (entry != null) {
        detach(entry);
        await teardownWhenIdle(entry);
      }
    },
    async close(): Promise<void> {
      closed = true;

      const all = Array.from(entries.values());
      entries.clear();

      await Promise.all(all.map((entry) => teardown(entry)));
    },
    stats(): FirebaseUserSessionPoolStats {
      let leased = 0;
      entries.forEach((entry) => {
        leased += entry.leases;
      });

      return { size: entries.size, leased, maxSessions };
    }
  };
}
