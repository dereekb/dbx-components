import { describe, it, expect } from 'vitest';
import { CliError } from '../util/output';
import { FIRESTORE_SESSION_API_PATH, cliFirestoreSessionErrorFactory, fetchFirestoreSession } from './firestore-session.client';

const SESSION_BODY = { uid: 'u1', customToken: 'ct', appCheckToken: 'act', expiresAt: '2026-01-01T00:00:00.000Z' };

describe('fetchFirestoreSession', () => {
  it('GETs <apiBaseUrl>/session/firestore with a bearer header and returns the parsed session', async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetcher = (async (input: any, init?: any) => {
      captured = { url: input as string, init };
      return new Response(JSON.stringify(SESSION_BODY), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const result = await fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 'token-abc', fetcher });

    expect(captured.url).toBe(`http://localhost/api${FIRESTORE_SESSION_API_PATH}`);
    expect((captured.init!.headers as Record<string, string>)['Authorization']).toBe('Bearer token-abc');
    expect(result).toEqual(SESSION_BODY);
  });

  it('strips a trailing slash from apiBaseUrl', async () => {
    let url = '';
    const fetcher = (async (input: any) => {
      url = input as string;
      return new Response(JSON.stringify(SESSION_BODY), { status: 200 });
    }) as typeof fetch;

    await fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api/', accessToken: 't', fetcher });
    expect(url).toBe(`http://localhost/api${FIRESTORE_SESSION_API_PATH}`);
  });

  it('maps a 403 to AUTH_FORBIDDEN with an admin/scope suggestion', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 })) as typeof fetch;

    await expect(fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher })).rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' });
  });

  it('maps a 404 to NOT_FOUND (the API does not serve the session endpoint)', async () => {
    const fetcher = (async () => new Response('', { status: 404 })) as typeof fetch;

    await expect(fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a 200 response with no customToken', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ uid: 'u1' }), { status: 200 })) as typeof fetch;

    await expect(fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher })).rejects.toMatchObject({ code: 'API_ERROR' });
  });

  it('accepts a session with no appCheckToken (App Check not configured on the API)', async () => {
    const fetcher = (async () => new Response(JSON.stringify({ uid: 'u1', customToken: 'ct', expiresAt: '2026-01-01T00:00:00.000Z' }), { status: 200 })) as typeof fetch;

    const result = await fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher });
    expect(result.appCheckToken).toBeUndefined();
    expect(result.customToken).toBe('ct');
  });

  it('throws a CliError, not the package-level FirestoreSessionError', async () => {
    // the CLI's error envelope (`buildErrorOutput`) reads `code`/`suggestion` off a `CliError`; the
    // generic error would fall through to `code: 'ERROR'`
    const fetcher = (async () => new Response('', { status: 500 })) as typeof fetch;
    const thrown = await fetchFirestoreSession({ apiBaseUrl: 'http://localhost/api', accessToken: 't', fetcher }).catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(CliError);
    expect((thrown as CliError).code).toBe('SERVER_ERROR');
  });
});

describe('cliFirestoreSessionErrorFactory()', () => {
  it('maps every generic session code onto the CLI code the commands assert on', () => {
    const codeFor = (code: Parameters<typeof cliFirestoreSessionErrorFactory>[0]['code']) => (cliFirestoreSessionErrorFactory({ code, message: 'x' }) as CliError).code;

    expect(codeFor('unauthorized')).toBe('AUTH_UNAUTHORIZED');
    expect(codeFor('forbidden')).toBe('AUTH_FORBIDDEN');
    expect(codeFor('not_found')).toBe('NOT_FOUND');
    expect(codeFor('unavailable')).toBe('SERVER_ERROR');
    expect(codeFor('invalid_response')).toBe('API_ERROR');
    expect(codeFor('invalid_config')).toBe('INVALID_ARGUMENT');
  });

  it('re-attaches the CLI login remediation for 401/403', () => {
    const error = cliFirestoreSessionErrorFactory({ code: 'forbidden', message: 'x', suggestion: 'the package-level text' }) as CliError;
    expect(error.suggestion).toContain('auth login');
  });

  it('passes a non-auth suggestion through untouched', () => {
    const error = cliFirestoreSessionErrorFactory({ code: 'not_found', message: 'x', suggestion: 'verify the API exposes it' }) as CliError;
    expect(error.suggestion).toBe('verify the API exposes it');
  });
});
