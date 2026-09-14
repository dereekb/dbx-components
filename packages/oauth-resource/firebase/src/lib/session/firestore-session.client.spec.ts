import { describe, expect, it } from 'vitest';
import { FIRESTORE_SESSION_API_PATH, type FirestoreSessionErrorInput, fetchFirestoreSession, isFirestoreSessionError } from './firestore-session.client';

const SESSION_BODY = { uid: 'u1', customToken: 'ct', appCheckToken: 'act', expiresAt: '2026-01-01T00:00:00.000Z' };

describe('fetchFirestoreSession()', () => {
  it('GETs <apiBaseUrl>/session/firestore with a bearer header and returns the parsed credentials', async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetcher = (async (input: unknown, init?: RequestInit) => {
      captured = { url: input as string, init };
      return new Response(JSON.stringify(SESSION_BODY), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const result = await fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 'token-abc', fetcher });

    expect(captured.url).toBe(`http://localhost/api${FIRESTORE_SESSION_API_PATH}`);
    expect((captured.init as RequestInit).headers as Record<string, string>).toMatchObject({ Authorization: 'Bearer token-abc' });
    expect(result).toEqual(SESSION_BODY);
  });

  it('strips a trailing slash from apiBaseUrl', async () => {
    let url = '';
    const fetcher = (async (input: unknown) => {
      url = input as string;
      return new Response(JSON.stringify(SESSION_BODY), { status: 200 });
    }) as typeof fetch;

    await fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api/', accessToken: 't', fetcher });
    expect(url).toBe(`http://localhost/api${FIRESTORE_SESSION_API_PATH}`);
  });

  it('maps a 403 to forbidden with an admin/scope suggestion', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 })) as typeof fetch;

    await expect(fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher })).rejects.toMatchObject({ code: 'forbidden', status: 403 });
  });

  it('maps a 401 to unauthorized', async () => {
    const fetcher = (async () => new Response('', { status: 401 })) as typeof fetch;

    await expect(fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher })).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('maps a 404 to not_found (the API does not serve the session endpoint)', async () => {
    const fetcher = (async () => new Response('', { status: 404 })) as typeof fetch;

    await expect(fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('maps a 500 to unavailable', async () => {
    const fetcher = (async () => new Response('', { status: 503 })) as typeof fetch;

    await expect(fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher })).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('rejects a 200 response with no customToken', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ uid: 'u1' }), { status: 200 })) as typeof fetch;

    const thrown = await fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher }).catch((e: unknown) => e);

    expect(isFirestoreSessionError(thrown)).toBe(true);
    expect(thrown).toMatchObject({ code: 'invalid_response' });
  });

  it('accepts credentials with no appCheckToken (App Check not configured on the API)', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ uid: 'u1', customToken: 'ct', expiresAt: '2026-01-01T00:00:00.000Z' }), { status: 200 })) as typeof fetch;

    const result = await fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher });
    expect(result.appCheckToken).toBeUndefined();
    expect(result.customToken).toBe('ct');
  });

  it('throws the injected errorFactory’s error instead of a FirestoreSessionError', async () => {
    // the seam that lets a consumer with its own error type avoid catch-and-rewrap
    class HostError extends Error {
      constructor(readonly input: FirestoreSessionErrorInput) {
        super(input.message);
      }
    }

    const fetcher = (async () => new Response(JSON.stringify({ message: 'nope' }), { status: 403 })) as typeof fetch;
    const thrown = await fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher, errorFactory: (input) => new HostError(input) }).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(HostError);
    expect(isFirestoreSessionError(thrown)).toBe(false);
    expect((thrown as HostError).input.code).toBe('forbidden');
    expect((thrown as HostError).input.suggestion).toContain('session.firestore');
  });
});
