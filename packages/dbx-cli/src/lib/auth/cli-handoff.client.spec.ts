import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimCliHandoff, cliHandoffBundleCredentialType } from './cli-handoff.client';

const BASE_BUNDLE = { uid: 'uid-1', issuer: 'http://x/oidc', clientId: 'cli-client', scope: 'openid demo', expiresAt: '2100-01-01T00:00:00.000Z' };

function stubClaimResponse(body: unknown, status = 201) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function claim() {
  return claimCliHandoff({ oidcIssuer: 'http://x/oidc/', code: 'CODE' });
}

describe('claimCliHandoff()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a bearer bundle', async () => {
    const fetchMock = stubClaimResponse({ ...BASE_BUNDLE, credentialType: 'bearer', accessToken: 'bearer-token', tokenType: 'Bearer' });

    const bundle = await claim();

    expect(bundle.accessToken).toBe('bearer-token');
    expect(cliHandoffBundleCredentialType(bundle)).toBe('bearer');
    expect(fetchMock.mock.calls[0][0]).toBe('http://x/oidc/cli-token/claim');
  });

  it('accepts a refresh bundle', async () => {
    stubClaimResponse({ ...BASE_BUNDLE, credentialType: 'refresh', refreshToken: 'refresh-token' });

    const bundle = await claim();

    expect(cliHandoffBundleCredentialType(bundle)).toBe('refresh');
    expect(bundle.refreshToken).toBe('refresh-token');
  });

  it('accepts a legacy bundle with no credentialType as a refresh credential', async () => {
    stubClaimResponse({ ...BASE_BUNDLE, refreshToken: 'refresh-token' });

    const bundle = await claim();

    expect(cliHandoffBundleCredentialType(bundle)).toBe('refresh');
  });

  it('rejects a bundle carrying neither secret', async () => {
    stubClaimResponse({ ...BASE_BUNDLE });

    await expect(claim()).rejects.toMatchObject({ code: 'AUTH_HANDOFF_FAILED' });
  });

  it('rejects a bearer bundle with no access token', async () => {
    stubClaimResponse({ ...BASE_BUNDLE, credentialType: 'bearer', refreshToken: 'refresh-token' });

    await expect(claim()).rejects.toMatchObject({ code: 'AUTH_HANDOFF_FAILED' });
  });

  it('reports a rejected code as AUTH_HANDOFF_FAILED', async () => {
    stubClaimResponse({ code: 'CLI_TOKEN_CLAIM_INVALID_ERROR' }, 404);

    await expect(claim()).rejects.toMatchObject({ code: 'AUTH_HANDOFF_FAILED' });
  });
});
