import { describe, it, expect } from 'vitest';
import { requireOkResponse, type FetchHandler } from '@dereekb/util/fetch';
import { zoomAccessTokenFromTokenResponse, zoomOAuthFactory, type ZoomOAuth } from './oauth.factory';
import { type ZoomOAuthAccessTokenResponse } from './oauth.api';
import { isZoomRefreshTokenCredential, zoomOAuthConfigAccountCredential } from './oauth.config';
import { type ZoomAccessToken, type ZoomAccessTokenCache } from './oauth';
import { ZoomOAuthAuthFailureError } from './oauth.error.api';

const ACCOUNT_ID = 'test-account-id';
const CLIENT_ID = 'test-client-id';
const CLIENT_SECRET = 'test-client-secret';
const USER_REFRESH_TOKEN = 'user-refresh-token';

interface RecordedTokenRequest {
  readonly grantType: string | null;
  readonly accountId: string | null;
  readonly refreshToken: string | null;
  readonly authorization: string | null;
}

/**
 * Builds an OAuth instance over a stubbed token endpoint, recording every request.
 *
 * Zoom puts the grant in the QUERY STRING rather than a JSON body, so the stub reads
 * `searchParams` rather than the request body.
 */
function testOAuth(accessTokenCache?: ZoomAccessTokenCache): { readonly zoomOAuth: ZoomOAuth; readonly requests: RecordedTokenRequest[] } {
  const requests: RecordedTokenRequest[] = [];
  let issued = 0;

  const fetchHandler: FetchHandler = async (request) => {
    const params = new URL(request.url).searchParams;

    requests.push({
      grantType: params.get('grant_type'),
      accountId: params.get('account_id'),
      refreshToken: params.get('refresh_token'),
      authorization: request.headers.get('Authorization')
    });

    issued += 1;

    const response: ZoomOAuthAccessTokenResponse = {
      access_token: `access-token-${issued}`,
      token_type: 'bearer',
      api_url: 'https://api.zoom.us',
      scope: 'user:read',
      expires_in: 3600
    };

    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const zoomOAuth = zoomOAuthFactory({ fetchHandler })({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    accountId: ACCOUNT_ID,
    accessTokenCache
  });

  return { zoomOAuth, requests };
}

describe('zoomAccessTokenFromTokenResponse()', () => {
  const response: ZoomOAuthAccessTokenResponse = {
    access_token: 'access-token',
    token_type: 'bearer',
    api_url: 'https://api.zoom.us',
    scope: 'user:read',
    expires_in: 3600
  };

  it('should map api_url to apiDomain', () => {
    expect(zoomAccessTokenFromTokenResponse(response).apiDomain).toBe('https://api.zoom.us');
  });

  it('should resolve expiresAt from expires_in', () => {
    const before = Date.now();
    const { expiresAt, expiresIn } = zoomAccessTokenFromTokenResponse(response);

    expect(expiresIn).toBe(3600);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600 * 1000);
  });
});

describe('isZoomRefreshTokenCredential()', () => {
  it('should be true for a refresh token credential', () => {
    expect(isZoomRefreshTokenCredential({ refreshToken: USER_REFRESH_TOKEN })).toBe(true);
  });

  it('should be false for an account credential', () => {
    expect(isZoomRefreshTokenCredential({ accountId: ACCOUNT_ID })).toBe(false);
  });
});

describe('zoomOAuthConfigAccountCredential()', () => {
  it('should derive the ambient credential from the config', () => {
    const accessTokenCache: ZoomAccessTokenCache = { loadCachedToken: async () => undefined, updateCachedToken: async () => undefined };
    const config = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, accountId: ACCOUNT_ID, accessTokenCache };

    expect(zoomOAuthConfigAccountCredential(config)).toEqual({ accountId: ACCOUNT_ID, accessTokenCache });
  });
});

describe('zoomOAuthFactory()', () => {
  describe('loadAccessToken()', () => {
    it('should use the account_credentials grant with the configured account id', async () => {
      const { zoomOAuth, requests } = testOAuth();

      await zoomOAuth.oauthContext.loadAccessToken();

      expect(requests).toHaveLength(1);
      expect(requests[0].grantType).toBe('account_credentials');
      expect(requests[0].accountId).toBe(ACCOUNT_ID);
    });
  });

  describe('makeAccessTokenFactory()', () => {
    it('should use the account id named on the credential rather than the configured one', async () => {
      const { zoomOAuth, requests } = testOAuth();

      await zoomOAuth.oauthContext.makeAccessTokenFactory({ accountId: 'other-account-id' })();

      expect(requests[0].grantType).toBe('account_credentials');
      expect(requests[0].accountId).toBe('other-account-id');
    });

    it('should use the refresh_token grant for a refresh token credential', async () => {
      const { zoomOAuth, requests } = testOAuth();

      await zoomOAuth.oauthContext.makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN })();

      expect(requests[0].grantType).toBe('refresh_token');
      expect(requests[0].refreshToken).toBe(USER_REFRESH_TOKEN);
    });

    it('should resolve a credential carrying BOTH fields to the refresh token arm', async () => {
      // accountId is also ambient on the config, so a credential carrying both reads as a user
      // credential that picked up an accountId — never the reverse
      const { zoomOAuth, requests } = testOAuth();

      await zoomOAuth.oauthContext.makeAccessTokenFactory({ accountId: ACCOUNT_ID, refreshToken: USER_REFRESH_TOKEN } as never)();

      expect(requests[0].grantType).toBe('refresh_token');
    });

    it('should Basic-auth both grants with the client pair', async () => {
      const { zoomOAuth, requests } = testOAuth();
      const { loadAccessToken, makeAccessTokenFactory } = zoomOAuth.oauthContext;

      await loadAccessToken();
      await makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN })();

      const expected = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;

      expect(requests.map((x) => x.authorization)).toEqual([expected, expected]);
    });

    it('should reuse a single factory in-memory rather than refreshing again', async () => {
      const { zoomOAuth, requests } = testOAuth();
      const factory = zoomOAuth.oauthContext.makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN });

      const first = await factory();
      const second = await factory();

      expect(requests).toHaveLength(1);
      expect(second.accessToken).toBe(first.accessToken);
    });

    it('should keep the account cache and a user cache from crossing', async () => {
      // the account token expires too, so both arms genuinely write — and the cache field name no
      // longer warns that a user's cache is not the account's
      const accountCached: ZoomAccessToken[] = [];
      const userCached: ZoomAccessToken[] = [];

      const accountCache: ZoomAccessTokenCache = {
        loadCachedToken: async () => undefined,
        updateCachedToken: async (token) => {
          accountCached.push(token);
        }
      };

      const userCache: ZoomAccessTokenCache = {
        loadCachedToken: async () => undefined,
        updateCachedToken: async (token) => {
          userCached.push(token);
        }
      };

      const { zoomOAuth } = testOAuth(accountCache);

      await zoomOAuth.oauthContext.loadAccessToken();
      await zoomOAuth.oauthContext.makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN, accessTokenCache: userCache })();

      expect(accountCached).toHaveLength(1);
      expect(userCached).toHaveLength(1);
      expect(accountCached[0].accessToken).not.toBe(userCached[0].accessToken);
    });

    it('should surface a refresher failure as a ZoomOAuthAuthFailureError', async () => {
      // a FetchHandler replaces the wrapped makeFetch, so the configured `requireOkResponse: true`
      // never runs against a stubbed response — applied here so the non-ok path matches the real stack
      const failingFetchHandler: FetchHandler = async () => requireOkResponse(Promise.resolve(new Response('{"error":"invalid_grant"}', { status: 400, headers: { 'Content-Type': 'application/json' } })));

      const { oauthContext } = zoomOAuthFactory({ fetchHandler: failingFetchHandler })({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        accountId: ACCOUNT_ID
      });

      await expect(oauthContext.makeAccessTokenFactory({ refreshToken: USER_REFRESH_TOKEN })()).rejects.toThrow(ZoomOAuthAuthFailureError);
    });
  });

  describe('a config that cannot authenticate', () => {
    it('should refuse a missing clientId', () => {
      expect(() => zoomOAuthFactory({})({ clientId: '', clientSecret: CLIENT_SECRET, accountId: ACCOUNT_ID })).toThrow();
    });

    it('should refuse a missing clientSecret', () => {
      expect(() => zoomOAuthFactory({})({ clientId: CLIENT_ID, clientSecret: '', accountId: ACCOUNT_ID })).toThrow();
    });

    it('should refuse a missing accountId', () => {
      expect(() => zoomOAuthFactory({})({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, accountId: '' })).toThrow();
    });
  });
});
