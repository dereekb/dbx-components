import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { DISCORD_API_URL } from '../discord.config';
import { DISCORD_OAUTH_TOKEN_CONTENT_TYPE, discordOAuthBasicAuthorizationHeader, exchangeAuthorizationCode, readCurrentUser, refreshAccessToken, type DiscordOAuthCurrentUser, type DiscordOAuthTokenResponse } from './oauth.api';
import { DISCORD_OAUTH_TOKEN_PATH, type DiscordOAuthContext } from './oauth.config';
import { discordOAuthFactory } from './oauth.factory';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';

/**
 * The URL every OAuth token request must resolve to.
 *
 * Asserted literally rather than composed from the constants, so a change to either the base URL or
 * the endpoint path is a visible, intentional edit to this spec.
 */
const EXPECTED_TOKEN_URL = 'https://discord.com/api/v10/oauth2/token';
const EXPECTED_CURRENT_USER_URL = 'https://discord.com/api/v10/users/@me';

const TOKEN_RESPONSE: DiscordOAuthTokenResponse = {
  access_token: 'access-token',
  token_type: 'Bearer',
  expires_in: 604800,
  refresh_token: 'next-refresh-token',
  scope: 'identify'
};

const CURRENT_USER: DiscordOAuthCurrentUser = {
  id: '80351110224678912',
  username: 'nelly',
  global_name: 'Nelly'
};

/**
 * Builds an OAuth context whose fetches are intercepted before leaving the process, capturing the
 * fully-resolved request so the composed URL, headers, and body can be asserted.
 *
 * The real default fetchFactory is used, so this exercises the actual base URL and base headers the
 * package ships.
 */
function testOAuthContext(responseBody: unknown = TOKEN_RESPONSE): { readonly oauthContext: DiscordOAuthContext; readonly requests: Request[] } {
  const requests: Request[] = [];

  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request);
    return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const { oauthContext } = discordOAuthFactory({ fetchHandler })({
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET
  });

  return { oauthContext, requests };
}

describe('DISCORD_API_URL', () => {
  it('should be an API base with no endpoint segment of its own', () => {
    // a base carrying its own endpoint segment is what produced Cal.com's doubly-pathed token URL
    expect(DISCORD_API_URL.endsWith(DISCORD_OAUTH_TOKEN_PATH)).toBe(false);
  });

  it('should pin an explicit api version', () => {
    // an unversioned base silently resolves to the oldest still-supported version
    expect(DISCORD_API_URL).toMatch(/\/v\d+$/);
  });
});

describe('discordOAuthBasicAuthorizationHeader()', () => {
  it('should base64 the client id and secret as a Basic credential pair', () => {
    expect(discordOAuthBasicAuthorizationHeader({ clientId: TEST_CLIENT_ID, clientSecret: TEST_CLIENT_SECRET })).toBe(`Basic ${btoa(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`)}`);
  });
});

describe('exchangeAuthorizationCode()', () => {
  const code = 'authorization-code';
  const redirectUri = 'http://localhost:9901/oauth/discord/callback';

  it('should POST to the resolved Discord token endpoint', async () => {
    const { oauthContext, requests } = testOAuthContext();

    await exchangeAuthorizationCode(oauthContext)({ code, redirectUri });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(EXPECTED_TOKEN_URL);
    expect(requests[0].method).toBe('POST');
  });

  it('should send a form-encoded body, not JSON', async () => {
    // Discord rejects a JSON body on the token endpoint outright
    const { oauthContext, requests } = testOAuthContext();

    await exchangeAuthorizationCode(oauthContext)({ code, redirectUri });

    expect(requests[0].headers.get('Content-Type')).toBe(DISCORD_OAUTH_TOKEN_CONTENT_TYPE);

    const body = new URLSearchParams(await requests[0].text());

    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe(code);
    expect(body.get('redirect_uri')).toBe(redirectUri);
  });

  it('should authenticate the client with HTTP Basic rather than credentials in the body', async () => {
    const { oauthContext, requests } = testOAuthContext();

    await exchangeAuthorizationCode(oauthContext)({ code, redirectUri });

    expect(requests[0].headers.get('Authorization')).toBe(`Basic ${btoa(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`)}`);

    const body = new URLSearchParams(await requests[0].text());

    expect(body.has('client_id')).toBe(false);
    expect(body.has('client_secret')).toBe(false);
  });

  it('should return the token response', async () => {
    const { oauthContext } = testOAuthContext();
    const response = await exchangeAuthorizationCode(oauthContext)({ code, redirectUri });

    expect(response.access_token).toBe('access-token');
    expect(response.refresh_token).toBe('next-refresh-token');
  });
});

describe('refreshAccessToken()', () => {
  it('should send the refresh_token grant form-encoded to the token endpoint', async () => {
    const { oauthContext, requests } = testOAuthContext();

    await refreshAccessToken(oauthContext)({ refreshToken: 'existing-refresh-token' });

    expect(requests[0].url).toBe(EXPECTED_TOKEN_URL);
    expect(requests[0].method).toBe('POST');

    const body = new URLSearchParams(await requests[0].text());

    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('existing-refresh-token');
  });

  it('should surface the refresh token the response carries', async () => {
    // Discord's refresh response returns a refresh token of its own, so the caller must persist it
    const { oauthContext } = testOAuthContext();
    const response = await refreshAccessToken(oauthContext)({ refreshToken: 'existing-refresh-token' });

    expect(response.refresh_token).toBe('next-refresh-token');
  });
});

describe('readCurrentUser()', () => {
  it('should GET the resolved current-user endpoint', async () => {
    const { oauthContext, requests } = testOAuthContext(CURRENT_USER);

    await readCurrentUser(oauthContext)({ accessToken: 'user-access-token' });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(EXPECTED_CURRENT_USER_URL);
    expect(requests[0].method).toBe('GET');
  });

  it("should authenticate as the user, overriding the client's Basic header", async () => {
    // this endpoint is Bearer-authenticated with the USER's token. If a per-request header did not
    // win over the base one, the client would need two ConfiguredFetch instances instead of one.
    const { oauthContext, requests } = testOAuthContext(CURRENT_USER);

    await readCurrentUser(oauthContext)({ accessToken: 'user-access-token' });

    expect(requests[0].headers.get('Authorization')).toBe('Bearer user-access-token');
    expect(requests[0].headers.get('Authorization')).not.toContain('Basic');
  });

  it('should return the identified user', async () => {
    const { oauthContext } = testOAuthContext(CURRENT_USER);
    const user = await readCurrentUser(oauthContext)({ accessToken: 'user-access-token' });

    expect(user.id).toBe('80351110224678912');
    expect(user.global_name).toBe('Nelly');
  });
});
