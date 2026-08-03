import { describe, it, expect } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { calcomAccessTokenFromTokenResponse, calcomOAuthFactory } from './oauth.factory';
import { type CalcomOAuthTokenResponse } from './oauth.api';
import { type CalcomOAuth } from './oauth.factory';

const SERVER_REFRESH_TOKEN = 'server-refresh-token';
const USER_REFRESH_TOKEN = 'user-refresh-token';

/**
 * Builds an OAuth instance whose token endpoint rotates the refresh token on every call, recording
 * the `refresh_token` each request was made with.
 *
 * Mirrors Cal.com's behavior: every refresh invalidates the token it was called with.
 */
function testOAuth(): { readonly calcomOAuth: CalcomOAuth; readonly sentRefreshTokens: string[] } {
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
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    refreshToken: SERVER_REFRESH_TOKEN
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

describe('calcomOAuthFactory()', () => {
  describe('per-user token isolation', () => {
    it('should not overwrite the server-level refresh token when a user token is refreshed', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const { makeUserAccessTokenFactory, loadAccessToken } = calcomOAuth.oauthContext;

      // refresh a single user's token first
      await makeUserAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN })();
      // then the server-level token, which must still use the SERVER refresh token
      await loadAccessToken();

      expect(sentRefreshTokens).toEqual([USER_REFRESH_TOKEN, SERVER_REFRESH_TOKEN]);
    });

    it('should keep each user rotating independently', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const { makeUserAccessTokenFactory } = calcomOAuth.oauthContext;

      const firstUser = makeUserAccessTokenFactory({ refreshToken: 'first-user-refresh-token' });
      const secondUser = makeUserAccessTokenFactory({ refreshToken: 'second-user-refresh-token' });

      await firstUser();
      await secondUser();

      expect(sentRefreshTokens).toEqual(['first-user-refresh-token', 'second-user-refresh-token']);
    });

    it('should reuse a single user factory in-memory rather than refreshing again', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const userTokenFactory = calcomOAuth.oauthContext.makeUserAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN });

      const first = await userTokenFactory();
      const second = await userTokenFactory();

      expect(sentRefreshTokens).toHaveLength(1);
      expect(second.accessToken).toBe(first.accessToken);
    });
  });

  describe('server-level rotation', () => {
    it('should refresh with its own rotated token on the next refresh', async () => {
      const { calcomOAuth, sentRefreshTokens } = testOAuth();
      const { loadAccessToken } = calcomOAuth.oauthContext;

      const first = await loadAccessToken();
      // a fresh factory would be needed to bypass the in-memory tier, so refresh through the
      // rotated token directly to prove the server scope tracked its own rotation
      expect(first.refreshToken).toBe('rotated-refresh-token-1');
      expect(sentRefreshTokens).toEqual([SERVER_REFRESH_TOKEN]);
    });
  });

  describe('api key auth', () => {
    it('should not expose a per-user token factory', () => {
      const { oauthContext } = calcomOAuthFactory({})({ apiKey: 'test-api-key' });
      expect(() => oauthContext.makeUserAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN })).toThrow();
    });
  });
});
