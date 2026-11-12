import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { exchangeAuthorizationCode, readCurrentUser, refreshAccessToken, type MicrosoftOAuthCurrentUser, type MicrosoftOAuthTokenResponse } from './oauth.api';
import { microsoftOAuthAccessTokenFromTokenResponse } from './oauth';
import { type MicrosoftOAuthContext } from './oauth.config';
import { isMicrosoftOAuthInvalidGrantError, MicrosoftOAuthError } from './oauth.error.api';
import { microsoftOAuthFactory } from './oauth.factory';

const TENANT_ID = 'contoso.onmicrosoft.com';
const CLIENT_ID = 'test-client-id';
const CLIENT_SECRET = 'test-client-secret';

/**
 * Asserted literally rather than composed from the constants, so a change to either is a visible,
 * intentional edit to this spec.
 */
const EXPECTED_TOKEN_URL = 'https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/token';
const EXPECTED_CURRENT_USER_URL = 'https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail';

const TOKEN_RESPONSE: MicrosoftOAuthTokenResponse = {
  access_token: 'access-token',
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: 'rotated-refresh-token',
  id_token: 'id-token',
  scope: 'https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read openid profile email offline_access'
};

const CURRENT_USER: MicrosoftOAuthCurrentUser = {
  id: '00000000-0000-0000-0000-000000000001',
  displayName: 'Ada Lovelace',
  userPrincipalName: 'ada@contoso.onmicrosoft.com'
};

function testOAuthContext(responseBody: unknown = TOKEN_RESPONSE, status = 200): { readonly oauthContext: MicrosoftOAuthContext; readonly requests: Request[] } {
  const requests: Request[] = [];

  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request);
    return new Response(JSON.stringify(responseBody), { status, headers: { 'Content-Type': 'application/json' } });
  };

  const { oauthContext } = microsoftOAuthFactory({ fetchHandler, logMicrosoftOAuthErrorFunction: () => undefined })({ tenantId: TENANT_ID, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
  return { oauthContext, requests };
}

describe('microsoftOAuthFactory()', () => {
  it('throws on a missing client id or secret', () => {
    expect(() => microsoftOAuthFactory()({ tenantId: TENANT_ID, clientId: '', clientSecret: CLIENT_SECRET })).toThrow('clientId');
    expect(() => microsoftOAuthFactory()({ tenantId: TENANT_ID, clientId: CLIENT_ID, clientSecret: '' })).toThrow('clientSecret');
  });

  it('throws on a multi-tenant authority', () => {
    expect(() => microsoftOAuthFactory()({ tenantId: 'organizations', clientId: CLIENT_ID, clientSecret: CLIENT_SECRET })).toThrow('multi-tenant');
  });
});

describe('exchangeAuthorizationCode()', () => {
  it('POSTs the code, verifier and client credentials to the tenant token endpoint', async () => {
    const { oauthContext, requests } = testOAuthContext();
    const response = await exchangeAuthorizationCode(oauthContext)({ code: 'code', redirectUri: 'http://localhost/cb', codeVerifier: 'verifier' });

    expect(response.access_token).toBe('access-token');
    expect(requests[0].url).toBe(EXPECTED_TOKEN_URL);
    expect(requests[0].method).toBe('POST');

    const body = new URLSearchParams(await requests[0].text());
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code');
    expect(body.get('code_verifier')).toBe('verifier');
    expect(body.get('client_id')).toBe(CLIENT_ID);
    expect(body.get('client_secret')).toBe(CLIENT_SECRET);
  });
});

describe('refreshAccessToken()', () => {
  it('sends no scope for a plain refresh', async () => {
    const { oauthContext, requests } = testOAuthContext();
    await refreshAccessToken(oauthContext)({ refreshToken: 'refresh-token' });

    const body = new URLSearchParams(await requests[0].text());
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-token');
    expect(body.has('scope')).toBe(false);
  });

  it('surfaces invalid_grant as a typed error', async () => {
    const { oauthContext } = testOAuthContext({ error: 'invalid_grant', error_description: 'AADSTS70008: expired', error_codes: [70008] }, 400);
    const error = await refreshAccessToken(oauthContext)({ refreshToken: 'refresh-token' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MicrosoftOAuthError);
    expect(isMicrosoftOAuthInvalidGrantError(error)).toBe(true);
    expect((error as MicrosoftOAuthError).error.error_codes).toEqual([70008]);
  });
});

describe('readCurrentUser()', () => {
  it('GETs the absolute Graph /me URL with the user bearer token', async () => {
    const { oauthContext, requests } = testOAuthContext(CURRENT_USER);
    const user = await readCurrentUser(oauthContext)({ accessToken: 'user-token' });

    expect(user.id).toBe(CURRENT_USER.id);
    expect(decodeURIComponent(requests[0].url)).toBe(EXPECTED_CURRENT_USER_URL);
    expect(requests[0].headers.get('Authorization')).toBe('Bearer user-token');
  });
});

describe('microsoftOAuthAccessTokenFromTokenResponse()', () => {
  it('normalises the granted scopes and keeps the rotated refresh and id tokens', () => {
    const token = microsoftOAuthAccessTokenFromTokenResponse(TOKEN_RESPONSE);

    expect(token.scopes).toEqual(['User.Read', 'Mail.Read']);
    expect(token.refreshToken).toBe('rotated-refresh-token');
    expect(token.idToken).toBe('id-token');
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
