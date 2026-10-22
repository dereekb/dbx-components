import { describe, expect, it } from 'vitest';
import { MS_IN_DAY, MS_IN_SECOND } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import { exchangeAuthorizationCode, readCurrentMember, refreshAccessToken, type TrelloOAuthCurrentMember, type TrelloOAuthTokenResponse } from './oauth.api';
import { trelloOAuthAccessTokenFromTokenResponse } from './oauth';
import { type TrelloOAuthContext } from './oauth.config';
import { trelloOAuthFactory } from './oauth.factory';
import { TrelloOAuthError } from './oauth.error.api';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';

/**
 * Asserted literally rather than composed from the constants, so a change to either is a visible,
 * intentional edit to this spec.
 */
const EXPECTED_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const EXPECTED_CURRENT_MEMBER_URL = 'https://api.trello.com/1/members/me?fields=id,username,fullName,email';

const TOKEN_RESPONSE: TrelloOAuthTokenResponse = {
  access_token: 'access-token',
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: 'rotated-refresh-token',
  scope: 'read:member:trello offline_access'
};

const CURRENT_MEMBER: TrelloOAuthCurrentMember = {
  id: '5a1b2c3d4e5f60718293a4b5',
  username: 'bot',
  fullName: 'Board Bot'
};

/**
 * Builds an OAuth context whose fetches are intercepted before leaving the process, capturing every
 * fully-resolved request — on both hosts.
 *
 * @param responseBody - The JSON body every request answers with.
 * @param status - The status every request answers with.
 * @returns The context and the captured requests.
 */
function testOAuthContext(responseBody: unknown = TOKEN_RESPONSE, status = 200): { readonly oauthContext: TrelloOAuthContext; readonly requests: Request[] } {
  const requests: Request[] = [];

  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request);
    return new Response(JSON.stringify(responseBody), { status, headers: { 'Content-Type': 'application/json' } });
  };

  const { oauthContext } = trelloOAuthFactory({ fetchHandler, logTrelloOAuthErrorFunction: () => undefined })({ clientId: TEST_CLIENT_ID, clientSecret: TEST_CLIENT_SECRET });
  return { oauthContext, requests };
}

describe('exchangeAuthorizationCode()', () => {
  it('should POST a JSON body carrying the client secret and the PKCE verifier to the token url', async () => {
    const { oauthContext, requests } = testOAuthContext();

    const response = await exchangeAuthorizationCode(oauthContext)({ code: 'the-code', redirectUri: 'http://localhost:9901/oauth/trello/callback', codeVerifier: 'the-verifier' });

    expect(response.access_token).toBe('access-token');
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(EXPECTED_TOKEN_URL);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].headers.get('content-type')).toBe('application/json');

    const body = await requests[0].json();
    expect(body).toEqual({
      grant_type: 'authorization_code',
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
      code: 'the-code',
      redirect_uri: 'http://localhost:9901/oauth/trello/callback',
      code_verifier: 'the-verifier'
    });
  });

  it('should surface an RFC 6749 error body as a TrelloOAuthError', async () => {
    const { oauthContext } = testOAuthContext({ error: 'invalid_grant', error_description: 'code already used' }, 400);

    await expect(exchangeAuthorizationCode(oauthContext)({ code: 'the-code', redirectUri: 'http://localhost', codeVerifier: 'v' })).rejects.toBeInstanceOf(TrelloOAuthError);
  });
});

describe('refreshAccessToken()', () => {
  it('should POST the refresh grant as JSON to the token url', async () => {
    const { oauthContext, requests } = testOAuthContext();

    await refreshAccessToken(oauthContext)({ refreshToken: 'stored-refresh-token' });

    expect(requests[0].url).toBe(EXPECTED_TOKEN_URL);
    expect(await requests[0].json()).toEqual({ grant_type: 'refresh_token', client_id: TEST_CLIENT_ID, client_secret: TEST_CLIENT_SECRET, refresh_token: 'stored-refresh-token' });
  });
});

describe('readCurrentMember()', () => {
  it('should GET /members/me on the bearer api url with the member token', async () => {
    const { oauthContext, requests } = testOAuthContext(CURRENT_MEMBER);

    const member = await readCurrentMember(oauthContext)({ accessToken: 'member-access-token' });

    expect(member.id).toBe(CURRENT_MEMBER.id);
    expect(requests[0].url).toBe(EXPECTED_CURRENT_MEMBER_URL);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].headers.get('authorization')).toBe('Bearer member-access-token');
  });
});

describe('trelloOAuthAccessTokenFromTokenResponse()', () => {
  it('should map the rotated refresh token and the expirations', () => {
    const before = Date.now();
    const token = trelloOAuthAccessTokenFromTokenResponse(TOKEN_RESPONSE);

    expect(token.refreshToken).toBe('rotated-refresh-token');
    expect(token.scope).toBe('read:member:trello offline_access');
    expect(token.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * MS_IN_SECOND);
    // no refresh_expires_in: the documented 90 days
    expect(token.refreshExpiresAt?.getTime()).toBeGreaterThanOrEqual(before + MS_IN_DAY * 90);
    expect(token.refreshExpiresAt?.getTime()).toBeLessThan(before + MS_IN_DAY * 91);
  });

  it('should prefer refresh_expires_in when the response carries one', () => {
    const before = Date.now();
    const token = trelloOAuthAccessTokenFromTokenResponse({ ...TOKEN_RESPONSE, refresh_expires_in: 600 });

    expect(token.refreshExpiresAt?.getTime()).toBeGreaterThanOrEqual(before + 600 * MS_IN_SECOND);
    expect(token.refreshExpiresAt?.getTime()).toBeLessThan(before + MS_IN_DAY);
  });

  it('should leave refreshExpiresAt unset without a refresh token', () => {
    const token = trelloOAuthAccessTokenFromTokenResponse({ ...TOKEN_RESPONSE, refresh_token: undefined });
    expect(token.refreshExpiresAt).toBeUndefined();
  });
});
