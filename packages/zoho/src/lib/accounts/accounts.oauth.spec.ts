import { describe, it, expect } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { zohoAccountsOAuthClientFactory, type ZohoAccountsOAuthClient } from './accounts.factory';
import { ZOHO_ACCOUNTS_API_URLS, isKnownZohoAccountsApiUrl, zohoAccountsApiUrlKeyForApiUrl } from './accounts.config';
import { zohoAccountsRefreshTokenFromAuthorizationCode, zohoAccountsUserInfo, type ZohoAccountsRefreshTokenFromAuthorizationCodeResponse } from './accounts.api';
import { ZohoAccountsAccessTokenError } from './accounts.error.api';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';
const TEST_CODE = '1000.abc123.def456';
const TEST_REDIRECT_URI = 'http://localhost:9901/oauth/zoho/callback';

/**
 * The URL every default-datacenter token request must resolve to.
 *
 * Asserted literally rather than composed from the constants: a base carrying its own endpoint
 * segment silently double-appends, and asserting the resolved `request.url` is the only thing that
 * catches it.
 */
const EXPECTED_TOKEN_URL_PREFIX = 'https://accounts.zoho.com/oauth/v2/token?';

const EXPECTED_USER_INFO_URL = 'https://accounts.zoho.com/oauth/user/info';

const TOKEN_RESPONSE: ZohoAccountsRefreshTokenFromAuthorizationCodeResponse = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  scope: 'AaaServer.profile.READ,ZohoCRM.modules.READ',
  api_domain: 'https://www.zohoapis.com',
  token_type: 'Bearer',
  expires_in: 3600
};

interface TestOAuthClient {
  readonly client: ZohoAccountsOAuthClient;
  readonly requests: Request[];
}

/**
 * Builds a client whose fetches are intercepted before leaving the process, capturing the
 * fully-resolved request so the composed URL can be asserted.
 *
 * The real default fetchFactory is used, so this exercises the actual base URL the package ships.
 *
 * @param response - The response body to answer every request with.
 * @returns The client and the captured requests.
 */
function testOAuthClient(response: object = TOKEN_RESPONSE): TestOAuthClient {
  const requests: Request[] = [];

  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request);
    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const client = zohoAccountsOAuthClientFactory({ fetchHandler })({
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET
  });

  return { client, requests };
}

describe('zohoAccountsOAuthClientFactory()', () => {
  it('should throw when given no client id', () => {
    expect(() => zohoAccountsOAuthClientFactory({})({ clientId: '', clientSecret: TEST_CLIENT_SECRET })).toThrow();
  });

  it('should throw when given no client secret', () => {
    expect(() => zohoAccountsOAuthClientFactory({})({ clientId: TEST_CLIENT_ID, clientSecret: '' })).toThrow();
  });

  it('should build a client without a refresh token', () => {
    // zohoAccountsFactory throws without one, which is circular for the flow that OBTAINS it
    expect(zohoAccountsOAuthClientFactory({})({ clientId: TEST_CLIENT_ID, clientSecret: TEST_CLIENT_SECRET }).oauthClientContext).toBeDefined();
  });
});

describe('zohoAccountsRefreshTokenFromAuthorizationCode()', () => {
  it('should POST to the resolved Zoho token endpoint', async () => {
    const { client, requests } = testOAuthClient();

    await zohoAccountsRefreshTokenFromAuthorizationCode(client.oauthClientContext)({ code: TEST_CODE, redirectUri: TEST_REDIRECT_URI });

    expect(requests).toHaveLength(1);
    expect(requests[0].url.startsWith(EXPECTED_TOKEN_URL_PREFIX)).toBe(true);
    expect(requests[0].method).toBe('POST');
  });

  it('should send the authorization_code grant as query params with an empty body', async () => {
    // Zoho takes these as query params, NOT as a JSON body the way Cal.com does
    const { client, requests } = testOAuthClient();

    await zohoAccountsRefreshTokenFromAuthorizationCode(client.oauthClientContext)({ code: TEST_CODE, redirectUri: TEST_REDIRECT_URI });

    const { searchParams } = new URL(requests[0].url);

    expect(searchParams.get('grant_type')).toBe('authorization_code');
    expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
    expect(searchParams.get('client_secret')).toBe(TEST_CLIENT_SECRET);
    expect(searchParams.get('code')).toBe(TEST_CODE);
    expect(searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
    expect(await requests[0].text()).toBe('');
  });

  it('should throw when Zoho answers with a 200 carrying an error body', async () => {
    // the whole reason this client reuses the full client's fetch construction
    const { client } = testOAuthClient({ error: 'invalid_code' });

    await expect(zohoAccountsRefreshTokenFromAuthorizationCode(client.oauthClientContext)({ code: TEST_CODE, redirectUri: TEST_REDIRECT_URI })).rejects.toBeInstanceOf(ZohoAccountsAccessTokenError);
  });

  it('should resolve without a refresh token when the re-consent returned none', async () => {
    const { refresh_token: _refreshToken, ...withoutRefreshToken } = TOKEN_RESPONSE;
    const { client } = testOAuthClient(withoutRefreshToken);

    const response = await zohoAccountsRefreshTokenFromAuthorizationCode(client.oauthClientContext)({ code: TEST_CODE, redirectUri: TEST_REDIRECT_URI });

    expect(response.access_token).toBe('access-token');
    expect(response.refresh_token).toBeUndefined();
  });
});

describe('zohoAccountsUserInfo()', () => {
  it('should GET the resolved user info endpoint with the Zoho-oauthtoken authorization', async () => {
    const { client, requests } = testOAuthClient({ ZUID: 12345, Email: 'user@example.com' });

    const response = await zohoAccountsUserInfo(client.oauthClientContext)({ accessToken: 'access-token' });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(EXPECTED_USER_INFO_URL);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].headers.get('Authorization')).toBe('Zoho-oauthtoken access-token');
    expect(response.Email).toBe('user@example.com');
  });
});

describe('isKnownZohoAccountsApiUrl()', () => {
  it('should accept every known datacenter host', () => {
    expect(Object.values(ZOHO_ACCOUNTS_API_URLS).every(isKnownZohoAccountsApiUrl)).toBe(true);
  });

  it('should reject a host that is not Zoho', () => {
    // this value arrives on an attacker-composable redirect and becomes the POST target the client
    // secret is sent to
    expect(isKnownZohoAccountsApiUrl('https://evil.example')).toBe(false);
  });

  it('should reject a matching host on the wrong scheme', () => {
    expect(isKnownZohoAccountsApiUrl('http://accounts.zoho.com')).toBe(false);
  });

  it('should reject a host that merely starts with a known one', () => {
    expect(isKnownZohoAccountsApiUrl('https://accounts.zoho.com.evil.example')).toBe(false);
  });

  it('should reject an absent value', () => {
    expect(isKnownZohoAccountsApiUrl(null)).toBe(false);
    expect(isKnownZohoAccountsApiUrl(undefined)).toBe(false);
  });
});

describe('zohoAccountsApiUrlKeyForApiUrl()', () => {
  it('should resolve a known host to its datacenter key', () => {
    expect(zohoAccountsApiUrlKeyForApiUrl(ZOHO_ACCOUNTS_API_URLS.eu)).toBe('eu');
  });

  it('should tolerate a trailing slash', () => {
    expect(zohoAccountsApiUrlKeyForApiUrl(`${ZOHO_ACCOUNTS_API_URLS.us}/`)).toBe('us');
  });

  it('should return undefined for an unknown host', () => {
    expect(zohoAccountsApiUrlKeyForApiUrl('https://evil.example')).toBeUndefined();
  });
});
