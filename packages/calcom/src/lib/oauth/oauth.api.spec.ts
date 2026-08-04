import { describe, it, expect } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { calcomOAuthFactory } from './oauth.factory';
import { CALCOM_OAUTH_API_URL, CALCOM_OAUTH_TOKEN_PATH, type CalcomOAuthContext } from './oauth.config';
import { exchangeAuthorizationCode, refreshAccessToken, type CalcomOAuthTokenResponse } from './oauth.api';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';
const TEST_REFRESH_TOKEN = 'test-refresh-token';

/**
 * The URL every OAuth token request must resolve to.
 *
 * Asserted literally rather than composed from the constants, so that a change to either the base
 * URL or the endpoint path is a visible, intentional edit to this spec.
 */
const EXPECTED_TOKEN_URL = 'https://api.cal.com/v2/auth/oauth2/token';

const TOKEN_RESPONSE: CalcomOAuthTokenResponse = {
  access_token: 'access-token',
  refresh_token: 'rotated-refresh-token',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'PROFILE_READ'
};

/**
 * Builds an OAuth context whose fetches are intercepted before leaving the process, capturing the
 * fully-resolved request so the composed URL can be asserted.
 *
 * The real default fetchFactory is used, so this exercises the actual base URL the package ships.
 */
function testOAuthContext(): { readonly oauthContext: CalcomOAuthContext; readonly requests: Request[] } {
  const requests: Request[] = [];

  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request);
    return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const { oauthContext } = calcomOAuthFactory({ fetchHandler })({
    defaultAuth: { refreshToken: TEST_REFRESH_TOKEN },
    client: { clientId: TEST_CLIENT_ID, clientSecret: TEST_CLIENT_SECRET }
  });

  return { oauthContext, requests };
}

describe('CALCOM_OAUTH_API_URL', () => {
  it('should be an API base with no endpoint segment of its own', () => {
    // a base carrying its own endpoint segment is what produced the doubly-pathed token URL
    expect(CALCOM_OAUTH_API_URL.endsWith(CALCOM_OAUTH_TOKEN_PATH)).toBe(false);
  });
});

describe('refreshAccessToken()', () => {
  it('should POST to the resolved Cal.com token endpoint', async () => {
    const { oauthContext, requests } = testOAuthContext();

    await refreshAccessToken(oauthContext)({ refreshToken: TEST_REFRESH_TOKEN });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(EXPECTED_TOKEN_URL);
    expect(requests[0].method).toBe('POST');
  });

  it('should send the refresh_token grant with the client credentials in a JSON body', async () => {
    const { oauthContext, requests } = testOAuthContext();

    await refreshAccessToken(oauthContext)({ refreshToken: TEST_REFRESH_TOKEN });

    expect(await requests[0].json()).toEqual({
      grant_type: 'refresh_token',
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
      refresh_token: TEST_REFRESH_TOKEN
    });
  });
});

describe('exchangeAuthorizationCode()', () => {
  const code = 'authorization-code';
  const redirectUri = 'http://localhost:9901/oauth/calcom/callback';

  it('should POST to the resolved Cal.com token endpoint', async () => {
    const { oauthContext, requests } = testOAuthContext();

    await exchangeAuthorizationCode(oauthContext)({ code, redirectUri });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(EXPECTED_TOKEN_URL);
    expect(requests[0].method).toBe('POST');
  });

  it('should send the authorization_code grant with the exact redirect_uri', async () => {
    const { oauthContext, requests } = testOAuthContext();

    await exchangeAuthorizationCode(oauthContext)({ code, redirectUri });

    expect(await requests[0].json()).toEqual({
      grant_type: 'authorization_code',
      client_id: TEST_CLIENT_ID,
      client_secret: TEST_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri
    });
  });
});
