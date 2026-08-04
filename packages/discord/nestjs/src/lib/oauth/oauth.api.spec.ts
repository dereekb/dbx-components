import { beforeEach, describe, expect, it } from 'vitest';
import { type DiscordOAuthCurrentUser, type DiscordOAuthTokenResponse } from '@dereekb/discord';
import { type FetchHandler } from '@dereekb/util/fetch';
import { DiscordOAuthApi } from './oauth.api';
import { type DiscordOAuthServiceConfig } from './oauth.config';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';
const TEST_REDIRECT_URI = 'http://localhost:9901/oauth/discord/callback';

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
 * Routes every Discord call to a canned response keyed by pathname, capturing the requests.
 */
function capturingFetchHandler() {
  const requests: Request[] = [];

  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request.clone());

    if (new URL(request.url).pathname.endsWith('/users/@me')) {
      return new Response(JSON.stringify(CURRENT_USER), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  return { fetchHandler, requests };
}

describe('DiscordOAuthApi', () => {
  let fetches: ReturnType<typeof capturingFetchHandler>;
  let api: DiscordOAuthApi;

  beforeEach(() => {
    fetches = capturingFetchHandler();

    const config: DiscordOAuthServiceConfig = {
      discordOAuth: { clientId: TEST_CLIENT_ID, clientSecret: TEST_CLIENT_SECRET },
      factoryConfig: { fetchHandler: fetches.fetchHandler, logDiscordOAuthErrorFunction: () => undefined }
    };

    api = new DiscordOAuthApi(config);
  });

  it('should expose the configured client id', () => {
    expect(api.clientId).toBe(TEST_CLIENT_ID);
  });

  it('should refuse to construct without both credentials', () => {
    // the core factory requires both, so an incomplete config must fail at startup
    expect(() => new DiscordOAuthApi({ discordOAuth: { clientId: TEST_CLIENT_ID } })).toThrow();
  });

  describe('authorizeUrlFactory()', () => {
    it('should compose an authorize url carrying the api client id and the caller scopes', () => {
      const url = api.authorizeUrlFactory({ redirectUri: TEST_REDIRECT_URI, scopes: ['identify'] })({ state: 'test-state' });
      const { origin, pathname, searchParams } = new URL(url);

      expect(origin).toBe('https://discord.com');
      expect(pathname).toBe('/oauth2/authorize');
      expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
      expect(searchParams.get('scope')).toBe('identify');
      expect(searchParams.get('state')).toBe('test-state');
    });
  });

  describe('exchangeAuthorizationCodeToAccessToken()', () => {
    it('should exchange a code and map the response to an access token', async () => {
      const accessToken = await api.exchangeAuthorizationCodeToAccessToken({ code: 'code', redirectUri: TEST_REDIRECT_URI });

      expect(accessToken.accessToken).toBe('access-token');
      expect(accessToken.refreshToken).toBe('next-refresh-token');
      expect(accessToken.expiresAt).toBeInstanceOf(Date);
    });

    it('should authenticate the token endpoint with the application basic credentials', async () => {
      await api.exchangeAuthorizationCodeToAccessToken({ code: 'code', redirectUri: TEST_REDIRECT_URI });

      const tokenRequest = fetches.requests[0];
      const expected = `Basic ${Buffer.from(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString('base64')}`;

      expect(tokenRequest.headers.get('Authorization')).toBe(expected);
      expect(new URLSearchParams(await tokenRequest.text()).get('code')).toBe('code');
    });
  });

  describe('refreshToAccessToken()', () => {
    it('should refresh with the stored token and map the response', async () => {
      const accessToken = await api.refreshToAccessToken({ refreshToken: 'stored-refresh-token' });

      expect(accessToken.accessToken).toBe('access-token');
      // Discord returns a refresh token of its own, so persist whatever came back
      expect(accessToken.refreshToken).toBe('next-refresh-token');

      const body = new URLSearchParams(await fetches.requests[0].text());

      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('stored-refresh-token');
    });
  });

  describe('readCurrentUser()', () => {
    it('should read the identity with the user bearer token, not the client credentials', async () => {
      const currentUser = await api.readCurrentUser({ accessToken: 'access-token' });

      expect(currentUser.id).toBe(CURRENT_USER.id);
      // the per-request header overrides the client's Basic header on the same configured fetch
      expect(fetches.requests[0].headers.get('Authorization')).toBe('Bearer access-token');
    });
  });
});
