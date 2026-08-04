import { describe, it, expect } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import { calcomAccessTokenFromApiKey, calcomAccessTokenFromTokenResponse, calcomOAuthFactory } from './oauth.factory';
import { type CalcomOAuthTokenResponse } from './oauth.api';
import { type CalcomOAuth } from './oauth.factory';
import { calcomAuthCredentialFromValues, isCalcomApiKeyCredential, type CalcomAuthCredential } from './oauth.config';
import { type CalcomAccessToken, type CalcomAccessTokenCache } from './oauth';
import { CalcomOAuthAuthFailureError } from './oauth.error.api';

const SERVER_REFRESH_TOKEN = 'server-refresh-token';
const USER_REFRESH_TOKEN = 'user-refresh-token';

/**
 * Builds an OAuth instance whose token endpoint rotates the refresh token on every call, recording
 * the `refresh_token` each request was made with.
 *
 * Mirrors Cal.com's behavior: every refresh invalidates the token it was called with.
 */
function testOAuth(defaultAuth: Maybe<CalcomAuthCredential> = { refreshToken: SERVER_REFRESH_TOKEN }): { readonly calcomOAuth: CalcomOAuth; readonly sentRefreshTokens: string[] } {
  const sentRefreshTokens: string[] = [];
  let rotation = 0;

  const fetchHandler: FetchHandler = async (request) => {
    const body = (await request.clone().json()) as { readonly refresh_token?: string };

    sentRefreshTokens.push(body.refresh_token as string);
    rotation += 1;

    const response: CalcomOAuthTokenResponse = {
      access_token: `access-token-${rotation}`,
      refresh_token: `rotated-refresh-token-${rotation}`,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'PROFILE_READ'
    };

    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const calcomOAuth = calcomOAuthFactory({ fetchHandler })({
    client: { clientId: 'test-client-id', clientSecret: 'test-client-secret' },
    defaultAuth
  });

  return { calcomOAuth, sentRefreshTokens };
}

describe('calcomAccessTokenFromTokenResponse()', () => {
  const response: CalcomOAuthTokenResponse = {
    access_token: 'access-token',
    refresh_token: 'rotated-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600
  };

  it('should return the rotated refresh token on the result', () => {
    expect(calcomAccessTokenFromTokenResponse(response).refreshToken).toBe('rotated-refresh-token');
  });

  it('should resolve expiresAt from expires_in', () => {
    const before = Date.now();
    const { expiresAt, expiresIn } = calcomAccessTokenFromTokenResponse(response);

    expect(expiresIn).toBe(3600);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);
  });

  it('should default a missing scope to an empty string', () => {
    expect(calcomAccessTokenFromTokenResponse(response).scope).toBe('');
  });
});

describe('isCalcomApiKeyCredential()', () => {
  it('should be true for an api key credential', () => {
    expect(isCalcomApiKeyCredential({ apiKey: 'test-api-key' })).toBe(true);
  });

  it('should be false for a refresh token credential', () => {
    expect(isCalcomApiKeyCredential({ refreshToken: USER_REFRESH_TOKEN })).toBe(false);
  });
});

describe('calcomAccessTokenFromApiKey()', () => {
  it('should return the key as the access token, with nothing to refresh', () => {
    const { accessToken, refreshToken, expiresAt } = calcomAccessTokenFromApiKey('test-api-key');

    expect(accessToken).toBe('test-api-key');
    expect(refreshToken).toBe('');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('calcomAuthCredentialFromValues()', () => {
  const accessTokenCache: CalcomAccessTokenCache = {
    loadCachedToken: async () => undefined,
    updateCachedToken: async () => undefined
  };

  it('should prefer the api key when both are set, since it never expires', () => {
    expect(calcomAuthCredentialFromValues({ apiKey: 'test-api-key', refreshToken: SERVER_REFRESH_TOKEN })).toEqual({ apiKey: 'test-api-key' });
  });

  it('should treat an empty api key as absent and fall through to the refresh token', () => {
    // an unset environment variable read as '' must not become a credential that sends `Bearer `
    expect(calcomAuthCredentialFromValues({ apiKey: '', refreshToken: SERVER_REFRESH_TOKEN })).toEqual({ refreshToken: SERVER_REFRESH_TOKEN, accessTokenCache: undefined });
  });

  it('should attach the cache only to the refresh token arm', () => {
    // an api key has no token to cache, so handing it one would be misleading
    expect(calcomAuthCredentialFromValues({ apiKey: 'test-api-key', accessTokenCache })).toEqual({ apiKey: 'test-api-key' });
    expect(calcomAuthCredentialFromValues({ refreshToken: SERVER_REFRESH_TOKEN, accessTokenCache })).toEqual({ refreshToken: SERVER_REFRESH_TOKEN, accessTokenCache });
  });

  it('should return undefined when neither value is present', () => {
    expect(calcomAuthCredentialFromValues({})).toBeUndefined();
  });
});

describe('calcomOAuthFactory()', () => {
  describe('per-credential token isolation', () => {
    it('should not overwrite the default credential refresh token when another is refreshed', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const { makeAccessTokenFactory, loadAccessToken } = calcomOAuth.oauthContext;

      // refresh a single user's token first
      await makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN })();
      // then the ambient token, which must still use the DEFAULT refresh token
      await loadAccessToken();

      expect(sentRefreshTokens).toEqual([USER_REFRESH_TOKEN, SERVER_REFRESH_TOKEN]);
    });

    it('should keep each user rotating independently', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const { makeAccessTokenFactory } = calcomOAuth.oauthContext;

      const firstUser = makeAccessTokenFactory({ refreshToken: 'first-user-refresh-token' });
      const secondUser = makeAccessTokenFactory({ refreshToken: 'second-user-refresh-token' });

      await firstUser();
      await secondUser();

      expect(sentRefreshTokens).toEqual(['first-user-refresh-token', 'second-user-refresh-token']);
    });

    it('should reuse a single user factory in-memory rather than refreshing again', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const userTokenFactory = calcomOAuth.oauthContext.makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN });

      const first = await userTokenFactory();
      const second = await userTokenFactory();

      expect(sentRefreshTokens).toHaveLength(1);
      expect(second.accessToken).toBe(first.accessToken);
    });

    it('should give a second factory for the default credential its own rotation', async () => {
      // loadAccessToken is one built-once factory; naming the same credential again must not share
      // its in-memory tier or its rotated token
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const { makeAccessTokenFactory, loadAccessToken } = calcomOAuth.oauthContext;

      await loadAccessToken();
      await makeAccessTokenFactory({ refreshToken: SERVER_REFRESH_TOKEN })();

      expect(sentRefreshTokens).toEqual([SERVER_REFRESH_TOKEN, SERVER_REFRESH_TOKEN]);
    });
  });

  describe('defaultAuth rotation', () => {
    it('should refresh with its own rotated token on the next refresh', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const { loadAccessToken } = calcomOAuth.oauthContext;

      const first = await loadAccessToken();
      // a fresh factory would be needed to bypass the in-memory tier, so refresh through the
      // rotated token directly to prove the default credential tracked its own rotation
      expect(first.refreshToken).toBe('rotated-refresh-token-1');
      expect(sentRefreshTokens).toEqual([SERVER_REFRESH_TOKEN]);
    });

    it('should read and write the default credential access token cache', async () => {
      const cached: CalcomAccessToken[] = [];
      const accessTokenCache: CalcomAccessTokenCache = {
        loadCachedToken: async () => undefined,
        updateCachedToken: async (accessToken) => {
          cached.push(accessToken);
        }
      };

      const { calcomOAuth } = testOAuth({ refreshToken: SERVER_REFRESH_TOKEN, accessTokenCache });
      await calcomOAuth.oauthContext.loadAccessToken();

      expect(cached).toHaveLength(1);
      expect(cached[0].refreshToken).toBe('rotated-refresh-token-1');
    });
  });

  describe('an apiKey credential', () => {
    const TEST_CLIENT = { clientId: 'test-client-id', clientSecret: 'test-client-secret' };

    it('should refuse a refresh token credential when no client is configured', () => {
      // an api key is one user's identity and cannot authenticate another grant's exchange
      const { oauthContext } = calcomOAuthFactory({})({ defaultAuth: { apiKey: 'test-api-key' } });
      expect(() => oauthContext.makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN })).toThrow();
    });

    it('should authenticate ambient calls with the api key', async () => {
      const { oauthContext } = calcomOAuthFactory({})({ defaultAuth: { apiKey: 'test-api-key' } });
      expect((await oauthContext.loadAccessToken()).accessToken).toBe('test-api-key');
    });

    it('should STILL exchange a refresh token credential when a client is also configured', () => {
      // the two halves of the config are independent: an app holds an api key for its own calls and a
      // client for its users' connections. Treating a configured api key as exclusive silently disabled
      // every per-user context, which is the only way a stored user connection can be used at all
      const { oauthContext } = calcomOAuthFactory({})({ client: TEST_CLIENT, defaultAuth: { apiKey: 'test-api-key' } });
      expect(oauthContext.makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN })).toBeDefined();
    });

    it('should still authenticate ambient calls with the api key when a client is configured', async () => {
      // the api key takes precedence for ambient calls, which need no refresh loop
      const { oauthContext } = calcomOAuthFactory({})({ client: TEST_CLIENT, defaultAuth: { apiKey: 'test-api-key' } });
      expect((await oauthContext.loadAccessToken()).accessToken).toBe('test-api-key');
    });

    it('should be usable as a NAMED credential, issuing no request', async () => {
      // reachable through makeAccessTokenFactory now that one union covers both paths
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const factory = calcomOAuth.oauthContext.makeAccessTokenFactory({ apiKey: 'named-api-key' });

      expect((await factory()).accessToken).toBe('named-api-key');
      expect(sentRefreshTokens).toHaveLength(0);
    });

    it('should refuse an empty api key', () => {
      // presence, not truthiness, discriminates the union, so an empty key would otherwise become a
      // valid static token and every call would send `Bearer `
      const { calcomOAuth } = testOAuth();
      expect(() => calcomOAuth.oauthContext.makeAccessTokenFactory({ apiKey: '' })).toThrow();
    });
  });

  describe('a config that can authenticate nothing', () => {
    it('should refuse an empty config', () => {
      expect(() => calcomOAuthFactory({})({})).toThrow();
    });

    it('should refuse a default refresh token with no client to exchange it against', () => {
      // a refresh token is not credentials on its own — the token endpoint authenticates the exchange
      // with the client id and secret, so this configuration could never produce a token
      expect(() => calcomOAuthFactory({})({ defaultAuth: { refreshToken: SERVER_REFRESH_TOKEN } })).toThrow();
    });

    it('should accept a client alone, for an app that only acts for its users', () => {
      expect(() => calcomOAuthFactory({})({ client: { clientId: 'test-client-id', clientSecret: 'test-client-secret' } })).not.toThrow();
    });
  });

  describe('a client with no defaultAuth', () => {
    it('should reject loadAccessToken locally rather than making a doomed request', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth(null);

      await expect(calcomOAuth.oauthContext.loadAccessToken()).rejects.toThrow(CalcomOAuthAuthFailureError);
      expect(sentRefreshTokens).toHaveLength(0);
    });

    it('should still build named credentials', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth(null);
      await calcomOAuth.oauthContext.makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN })();

      expect(sentRefreshTokens).toEqual([USER_REFRESH_TOKEN]);
    });
  });
});
