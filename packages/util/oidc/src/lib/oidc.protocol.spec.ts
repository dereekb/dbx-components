import { describe, it, expect, vi } from 'vitest';
import { OidcRelyingPartyError } from '@dereekb/util';
import { type OidcRelyingPartyFetch, discoverOidcMetadata, exchangeAuthorizationCode, fetchUserInfo, refreshAccessToken, revokeToken } from './oidc.protocol';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * Captures the (url, init) of each call and replies with the queued responses in order.
 */
function mockFetch(responses: Response[]): { fetch: OidcRelyingPartyFetch; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  let index = 0;
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: input.toString(), init });
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return response;
  });
  return { fetch: fetchFn as unknown as OidcRelyingPartyFetch, calls };
}

function bodyParams(init?: RequestInit): URLSearchParams {
  return new URLSearchParams((init?.body as string) ?? '');
}

describe('discoverOidcMetadata()', () => {
  it('returns the first OK candidate', async () => {
    const { fetch, calls } = mockFetch([new Response('nope', { status: 404 }), jsonResponse({ issuer: 'https://api.example.com/oidc', authorization_endpoint: 'a', token_endpoint: 't' })]);

    const meta = await discoverOidcMetadata({ issuer: 'https://api.example.com/oidc', fetch });

    expect(meta.issuer).toBe('https://api.example.com/oidc');
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('https://api.example.com/oidc/.well-known/openid-configuration');
    expect(calls[1].url).toBe('https://api.example.com/.well-known/openid-configuration');
  });

  it('throws DISCOVERY_FAILED when every candidate fails', async () => {
    const { fetch } = mockFetch([new Response('nope', { status: 500 })]);
    await expect(discoverOidcMetadata({ issuer: 'https://api.example.com/oidc', fetch })).rejects.toMatchObject({ code: 'DISCOVERY_FAILED' });
  });
});

describe('exchangeAuthorizationCode()', () => {
  it('omits client_secret for a public PKCE client', async () => {
    const { fetch, calls } = mockFetch([jsonResponse({ access_token: 'at', refresh_token: 'rt' })]);

    const result = await exchangeAuthorizationCode({ tokenEndpoint: 'https://api.example.com/oidc/token', clientId: 'cid', redirectUri: 'https://app/cb', code: 'code', codeVerifier: 'verifier', fetch });

    expect(result.access_token).toBe('at');
    const params = bodyParams(calls[0].init);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('client_id')).toBe('cid');
    expect(params.get('code_verifier')).toBe('verifier');
    expect(params.has('client_secret')).toBe(false);
  });

  it('includes client_secret for a confidential client', async () => {
    const { fetch, calls } = mockFetch([jsonResponse({ access_token: 'at' })]);

    await exchangeAuthorizationCode({ tokenEndpoint: 'https://api.example.com/oidc/token', clientId: 'cid', clientSecret: 'shh', redirectUri: 'https://app/cb', code: 'code', codeVerifier: 'verifier', fetch });

    expect(bodyParams(calls[0].init).get('client_secret')).toBe('shh');
  });

  it('maps an invalid_grant error to TOKEN_INVALID_GRANT', async () => {
    const { fetch } = mockFetch([jsonResponse({ error: 'invalid_grant', error_description: 'bad code' }, 400)]);
    await expect(exchangeAuthorizationCode({ tokenEndpoint: 't', clientId: 'cid', redirectUri: 'r', code: 'c', codeVerifier: 'v', fetch })).rejects.toMatchObject({ code: 'TOKEN_INVALID_GRANT' });
  });

  it('maps other token errors to TOKEN_EXCHANGE_FAILED', async () => {
    const { fetch } = mockFetch([jsonResponse({ error: 'invalid_request' }, 400)]);
    await expect(exchangeAuthorizationCode({ tokenEndpoint: 't', clientId: 'cid', redirectUri: 'r', code: 'c', codeVerifier: 'v', fetch })).rejects.toBeInstanceOf(OidcRelyingPartyError);
  });
});

describe('refreshAccessToken()', () => {
  it('posts the refresh_token grant', async () => {
    const { fetch, calls } = mockFetch([jsonResponse({ access_token: 'at-2', refresh_token: 'rt-2' })]);

    const result = await refreshAccessToken({ tokenEndpoint: 'https://api.example.com/oidc/token', clientId: 'cid', refreshToken: 'rt-1', fetch });

    expect(result.access_token).toBe('at-2');
    const params = bodyParams(calls[0].init);
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('rt-1');
    expect(params.has('client_secret')).toBe(false);
  });
});

describe('revokeToken()', () => {
  it('resolves on a 2xx response', async () => {
    const { fetch, calls } = mockFetch([new Response('', { status: 200 })]);
    await expect(revokeToken({ revocationEndpoint: 'https://api.example.com/oidc/token/revocation', clientId: 'cid', token: 'rt', tokenTypeHint: 'refresh_token', fetch })).resolves.toBeUndefined();
    const params = bodyParams(calls[0].init);
    expect(params.get('token')).toBe('rt');
    expect(params.get('token_type_hint')).toBe('refresh_token');
  });

  it('throws TOKEN_REVOCATION_FAILED on an error response', async () => {
    const { fetch } = mockFetch([new Response('', { status: 503 })]);
    await expect(revokeToken({ revocationEndpoint: 'r', clientId: 'cid', token: 'rt', fetch })).rejects.toMatchObject({ code: 'TOKEN_REVOCATION_FAILED' });
  });
});

describe('fetchUserInfo()', () => {
  it('sends a Bearer access token and returns the claims', async () => {
    const { fetch, calls } = mockFetch([jsonResponse({ sub: 'user-1' })]);

    const claims = await fetchUserInfo({ userinfoEndpoint: 'https://api.example.com/oidc/me', accessToken: 'at', fetch });

    expect(claims).toEqual({ sub: 'user-1' });
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer at');
  });

  it('throws USERINFO_FAILED on a non-OK response', async () => {
    const { fetch } = mockFetch([new Response('', { status: 401 })]);
    await expect(fetchUserInfo({ userinfoEndpoint: 'u', accessToken: 'at', fetch })).rejects.toMatchObject({ code: 'USERINFO_FAILED' });
  });
});
