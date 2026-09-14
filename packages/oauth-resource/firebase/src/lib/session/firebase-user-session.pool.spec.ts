import { describe, expect, it } from 'vitest';
import { type FirebaseUserSession, type OpenFirebaseUserSessionInput, firebaseUserSessionAppName } from './firebase-user-session';
import { FIRESTORE_SESSION_MAX_CACHE_MS } from './firestore-session.cache';
import { type FirebaseUserSessionPoolEvent, type FirebaseUserSessionPoolEventType, firebaseUserSessionPool } from './firebase-user-session.pool';

const NAMESPACE = 'pool-spec';
const FIREBASE = { apiKey: 'k', projectId: 'demo-pool', appId: '1:1:web:1' };
const API_BASE_URL = 'http://localhost/api';
const NOW = Date.parse('2026-08-19T12:00:00.000Z');

/**
 * A fake opener + fake clock so the pool's lifecycle rules are exercised with no Firebase involved.
 */
function testHarness(input?: { readonly expiresAtMs?: number; readonly failFor?: ReadonlySet<string> }) {
  const opened: OpenFirebaseUserSessionInput[] = [];
  const events: FirebaseUserSessionPoolEvent[] = [];
  let nowMs = NOW;

  const openSession = async (openInput: OpenFirebaseUserSessionInput): Promise<FirebaseUserSession> => {
    opened.push(openInput);

    const uid = openInput.uid as string;

    if (input?.failFor?.has(uid)) {
      throw Object.assign(new Error(`open failed for ${uid}`), { code: 'invalid_response' });
    }

    const appName = firebaseUserSessionAppName({ namespace: openInput.namespace, scope: openInput.scope as string, uid });
    const createdAt = nowMs;
    const expiresAt = input?.expiresAtMs ?? createdAt + FIRESTORE_SESSION_MAX_CACHE_MS;

    return {
      uid,
      credentials: { uid, customToken: 'ct', expiresAt: new Date(expiresAt).toISOString() },
      fromCache: false,
      appName,
      // `deleteApp` reads `app` off the registry by identity; the pool only ever hands it back
      app: { name: appName, options: {}, automaticDataCollectionEnabled: false } as unknown as FirebaseUserSession['app'],
      auth: {} as FirebaseUserSession['auth'],
      firestore: {} as FirebaseUserSession['firestore'],
      firestoreContext: {} as FirebaseUserSession['firestoreContext'],
      createdAt,
      expiresAt
    };
  };

  return {
    opened,
    events,
    get now() {
      return nowMs;
    },
    advance(ms: number) {
      nowMs += ms;
    },
    set(ms: number) {
      nowMs = ms;
    },
    openSession,
    eventTypes(): FirebaseUserSessionPoolEventType[] {
      return events.map((x) => x.type);
    },
    onEvent(event: FirebaseUserSessionPoolEvent) {
      events.push(event);
    },
    nowGetter: () => nowMs
  };
}

/**
 * The apps the pool attempted to dispose.
 *
 * Teardown is observed through the pool's own events rather than by spying on `deleteApp`, because
 * this spec deliberately registers no real Firebase apps. `closed` and `teardown-failed` are both
 * "the pool reached the teardown call", which is the property under test.
 */
function disposedApps(events: readonly FirebaseUserSessionPoolEvent[]): string[] {
  return events.filter((x) => x.type === 'closed' || x.type === 'teardown-failed').map((x) => x.appName);
}

/**
 * Lets a `void`-ed teardown chain settle.
 */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function poolFor(harness: ReturnType<typeof testHarness>, overrides?: { readonly maxSessions?: number; readonly maxSessionAgeMs?: number; readonly refreshSkewMs?: number }) {
  return firebaseUserSessionPool({
    namespace: NAMESPACE,
    firebase: FIREBASE,
    apiBaseUrl: API_BASE_URL,
    openSession: harness.openSession,
    now: harness.nowGetter,
    onEvent: (event) => harness.onEvent(event),
    ...overrides
  });
}

describe('firebaseUserSessionPool()', () => {
  it('opens once and reuses the session across sequential acquisitions for one uid', async () => {
    const harness = testHarness();
    const pool = poolFor(harness);

    const first = await pool.openSession({ uid: 'u1', accessToken: 't' });
    first.release();
    const second = await pool.openSession({ uid: 'u1', accessToken: 't' });
    second.release();

    expect(harness.opened).toHaveLength(1);
    expect(harness.eventTypes()).toEqual(['opened', 'reused']);
    expect(first.session).toBe(second.session);
    expect(pool.stats().size).toBe(1);
  });

  it('shares one open across two CONCURRENT acquisitions for one uid, handing out two leases', async () => {
    const harness = testHarness();
    const pool = poolFor(harness);

    const [a, b] = await Promise.all([pool.openSession({ uid: 'u1', accessToken: 't' }), pool.openSession({ uid: 'u1', accessToken: 't' })]);

    expect(harness.opened).toHaveLength(1);
    expect(pool.stats().leased).toBe(2);

    a.release();
    expect(pool.stats().leased).toBe(1);
    b.release();
    expect(pool.stats().leased).toBe(0);
  });

  it('keys distinct uids to distinct app names and distinct opens', async () => {
    const harness = testHarness();
    const pool = poolFor(harness);

    const a = await pool.openSession({ uid: 'u1', accessToken: 't' });
    const b = await pool.openSession({ uid: 'u2', accessToken: 't' });

    expect(harness.opened).toHaveLength(2);
    expect(a.session.appName).not.toBe(b.session.appName);
    expect(a.session.appName).toBe(`${NAMESPACE}::${FIREBASE.projectId}::u1`);
    expect(pool.stats().size).toBe(2);

    a.release();
    b.release();
  });

  it('tears down and re-opens a session past its expiry minus the refresh skew', async () => {
    const harness = testHarness();
    const pool = poolFor(harness, { refreshSkewMs: 60_000 });

    const first = await pool.openSession({ uid: 'u1', accessToken: 't' });
    first.release();

    harness.advance(FIRESTORE_SESSION_MAX_CACHE_MS - 30_000);

    const second = await pool.openSession({ uid: 'u1', accessToken: 't' });
    second.release();

    expect(harness.opened).toHaveLength(2);
    await flush();

    expect(harness.eventTypes()).toContain('expired');
    expect(disposedApps(harness.events)).toContain(`${NAMESPACE}::${FIREBASE.projectId}::u1`);
    expect(pool.stats().size).toBe(1);
  });

  it('caps a session claiming a six-hour expiry at maxSessionAgeMs', async () => {
    // the endpoint's `expiresAt` is a claim; the pool's ceiling is not negotiable
    const harness = testHarness({ expiresAtMs: NOW + 6 * 60 * 60 * 1000 });
    const pool = poolFor(harness, { maxSessionAgeMs: 10 * 60 * 1000, refreshSkewMs: 0 });

    const first = await pool.openSession({ uid: 'u1', accessToken: 't' });
    first.release();

    harness.advance(11 * 60 * 1000);

    const second = await pool.openSession({ uid: 'u1', accessToken: 't' });
    second.release();

    expect(harness.opened).toHaveLength(2);
    expect(harness.eventTypes()).toContain('expired');
  });

  it('evicts the least-recently-used IDLE entry at cap', async () => {
    const harness = testHarness();
    const pool = poolFor(harness, { maxSessions: 2 });

    const a = await pool.openSession({ uid: 'u1', accessToken: 't' });
    a.release();
    harness.advance(1000);

    const b = await pool.openSession({ uid: 'u2', accessToken: 't' });
    b.release();
    harness.advance(1000);

    const c = await pool.openSession({ uid: 'u3', accessToken: 't' });
    c.release();

    expect(harness.eventTypes()).toContain('evicted');
    expect(harness.events.find((x) => x.type === 'evicted')?.uid).toBe('u1');
    expect(pool.stats().size).toBe(2);
  });

  it('admits over cap rather than refusing a user or killing a live handle, tearing the marked entry down on ITS release', async () => {
    const harness = testHarness();
    const pool = poolFor(harness, { maxSessions: 1 });

    const a = await pool.openSession({ uid: 'u1', accessToken: 't' });
    // u1 stays LEASED, so there is nothing idle to evict
    const b = await pool.openSession({ uid: 'u2', accessToken: 't' });

    const overCapacity = harness.events.find((x) => x.type === 'over-capacity');
    expect(overCapacity?.uid).toBe('u1');
    expect(b.session.uid).toBe('u2');

    // the marked entry is NOT torn down while its lease is live
    expect(disposedApps(harness.events)).not.toContain(`${NAMESPACE}::${FIREBASE.projectId}::u1`);

    a.release();
    await flush();

    expect(disposedApps(harness.events)).toContain(`${NAMESPACE}::${FIREBASE.projectId}::u1`);

    b.release();
  });

  it('release() is idempotent', async () => {
    const harness = testHarness();
    const pool = poolFor(harness);

    const lease = await pool.openSession({ uid: 'u1', accessToken: 't' });
    lease.release();
    lease.release();
    lease.release();

    expect(pool.stats().leased).toBe(0);
  });

  it('removes a rejected open so the next acquisition retries rather than replaying the failure', async () => {
    const failFor = new Set(['u1']);
    const harness = testHarness({ failFor });
    const pool = poolFor(harness);

    await expect(pool.openSession({ uid: 'u1', accessToken: 't' })).rejects.toThrow('open failed for u1');
    expect(pool.stats().size).toBe(0);
    expect(pool.stats().leased).toBe(0);

    failFor.delete('u1');

    const lease = await pool.openSession({ uid: 'u1', accessToken: 't' });
    expect(harness.opened).toHaveLength(2);
    expect(lease.session.uid).toBe('u1');
    lease.release();
  });

  it('close() tears everything down and latches the pool closed', async () => {
    const harness = testHarness();
    const pool = poolFor(harness);

    (await pool.openSession({ uid: 'u1', accessToken: 't' })).release();
    (await pool.openSession({ uid: 'u2', accessToken: 't' })).release();

    await pool.close();

    expect(pool.stats().size).toBe(0);
    expect(disposedApps(harness.events)).toHaveLength(2);
    await expect(pool.openSession({ uid: 'u1', accessToken: 't' })).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('closeSession(uid) tears down exactly one', async () => {
    const harness = testHarness();
    const pool = poolFor(harness);

    (await pool.openSession({ uid: 'u1', accessToken: 't' })).release();
    const keep = await pool.openSession({ uid: 'u2', accessToken: 't' });

    await pool.closeSession('u1');

    expect(disposedApps(harness.events)).toEqual([`${NAMESPACE}::${FIREBASE.projectId}::u1`]);
    expect(pool.stats().size).toBe(1);

    keep.release();
  });

  it('passes the acquiring uid into the opener so the mint response can be asserted against it', async () => {
    const harness = testHarness();
    const pool = poolFor(harness);

    (await pool.openSession({ uid: 'u1', accessToken: 'token-abc' })).release();

    expect(harness.opened[0].uid).toBe('u1');
    expect(harness.opened[0].accessToken).toBe('token-abc');
    expect(harness.opened[0].namespace).toBe(NAMESPACE);
    expect(harness.opened[0].scope).toBe(FIREBASE.projectId);
  });

  it('useSession() releases the lease however the callback settles', async () => {
    const harness = testHarness();
    const pool = poolFor(harness);

    const value = await pool.useSession({ uid: 'u1', accessToken: 't' }, async (session) => session.uid);
    expect(value).toBe('u1');
    expect(pool.stats().leased).toBe(0);

    await expect(
      pool.useSession({ uid: 'u1', accessToken: 't' }, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(pool.stats().leased).toBe(0);
  });
});
