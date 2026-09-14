import { describe, expect, it } from 'vitest';
import { firebaseClientEmulatorsInUse, isFirebaseClientConfigComplete } from './firebase-client.config';
import { firebaseUserSessionAppName, firebaseUserSessionNamespacePrefix, openFirebaseUserSession } from './firebase-user-session';

const FIREBASE = { apiKey: 'fake-api-key', projectId: 'demo-user-session', appId: '1:1:web:1' };

describe('firebaseUserSessionAppName()', () => {
  it('joins namespace, scope, and uid with the `::` separator', () => {
    expect(firebaseUserSessionAppName({ namespace: 'srv', scope: 'demo-project', uid: 'u1' })).toBe('srv::demo-project::u1');
  });

  it('cannot collide across the project-id / uid boundary the way a `-` separator would', () => {
    // `srv-a-b-c` is what a single `-` produces for BOTH of these, and a Firebase project id is
    // `[a-z0-9-]+` so the ambiguity is reachable; `:` cannot appear in a project id
    const left = firebaseUserSessionAppName({ namespace: 'srv', scope: 'a-b', uid: 'c' });
    const right = firebaseUserSessionAppName({ namespace: 'srv', scope: 'a', uid: 'b-c' });

    expect(left).not.toBe(right);
  });

  it('is prefixed by its namespace sweep prefix, so the teardown sweep finds it', () => {
    const name = firebaseUserSessionAppName({ namespace: 'srv', scope: 'p', uid: 'u1' });
    expect(name.startsWith(firebaseUserSessionNamespacePrefix('srv'))).toBe(true);
    expect(name.startsWith(firebaseUserSessionNamespacePrefix('other'))).toBe(false);
  });
});

describe('isFirebaseClientConfigComplete()', () => {
  it('requires apiKey, projectId, and appId', () => {
    expect(isFirebaseClientConfigComplete(undefined)).toBe(false);
    expect(isFirebaseClientConfigComplete({ apiKey: 'k', projectId: 'p' })).toBe(false);
    expect(isFirebaseClientConfigComplete({ apiKey: 'k', projectId: 'p', appId: 'a' })).toBe(true);
  });
});

describe('firebaseClientEmulatorsInUse()', () => {
  it('is false with no emulator config', () => {
    expect(firebaseClientEmulatorsInUse({ apiKey: 'k', projectId: 'p', appId: 'a' })).toBe(false);
  });

  it('is true when a port is configured', () => {
    expect(firebaseClientEmulatorsInUse({ emulators: { firestorePort: 9904 } })).toBe(true);
  });

  it('is false when explicitly disabled', () => {
    expect(firebaseClientEmulatorsInUse({ emulators: { useEmulators: false, firestorePort: 9904 } })).toBe(false);
  });
});

describe('openFirebaseUserSession()', () => {
  it('rejects an incomplete Firebase client config before any network call', async () => {
    const fetcher = (() => {
      throw new Error('the mint call must not be attempted with an unusable config');
    }) as unknown as typeof fetch;

    await expect(openFirebaseUserSession({ namespace: 'srv', firebase: { apiKey: 'k' }, apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher })).rejects.toMatchObject({ code: 'invalid_config' });
  });

  it('refuses credentials minted for a different uid than the one requested', async () => {
    // the consume-side check on the endpoint's central security property: the custom token is always
    // minted for the presented token's own `auth.uid`, with no way to name another user. Asserted
    // BEFORE `initializeApp`, so no Firebase app is registered for a mismatched envelope.
    const fetcher = (async () => new Response(JSON.stringify({ uid: 'someone-else', customToken: 'ct', expiresAt: '2099-01-01T00:00:00.000Z' }), { status: 200 })) as typeof fetch;

    await expect(openFirebaseUserSession({ namespace: 'srv', firebase: FIREBASE, apiBaseUrl: 'http://localhost/api', accessToken: 't', uid: 'u1', fetcher })).rejects.toMatchObject({ code: 'invalid_response' });
  });
});
