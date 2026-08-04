import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { type DiscordOAuthTokenResponse } from './oauth.api';
import { discordOAuthFactory } from './oauth.factory';
import { discordAccessTokenFromTokenResponse } from './oauth';

const TOKEN_RESPONSE: DiscordOAuthTokenResponse = {
  access_token: 'access-token',
  token_type: 'Bearer',
  expires_in: 604800,
  refresh_token: 'next-refresh-token',
  scope: 'identify'
};

describe('discordAccessTokenFromTokenResponse()', () => {
  it('should carry the refresh token the response returned', () => {
    expect(discordAccessTokenFromTokenResponse(TOKEN_RESPONSE).refreshToken).toBe('next-refresh-token');
  });

  it('should resolve expiresAt from expires_in', () => {
    const before = Date.now();
    const { expiresAt, expiresIn } = discordAccessTokenFromTokenResponse(TOKEN_RESPONSE);

    expect(expiresIn).toBe(604800);
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 604800 * 1000);
  });

  it('should default a missing scope to an empty string', () => {
    expect(discordAccessTokenFromTokenResponse({ ...TOKEN_RESPONSE, scope: undefined }).scope).toBe('');
  });
});

describe('discordOAuthFactory()', () => {
  it('should throw when no clientId is configured', () => {
    // otherwise the authorize URL composes client_id=undefined and fails at the consent screen
    expect(() => discordOAuthFactory({})({ clientId: '', clientSecret: 'test-client-secret' })).toThrow();
  });

  it('should throw when no clientSecret is configured', () => {
    expect(() => discordOAuthFactory({})({ clientId: 'test-client-id', clientSecret: '' })).toThrow();
  });

  it('should build a context carrying the configured credentials', () => {
    const { oauthContext } = discordOAuthFactory({})({ clientId: 'test-client-id', clientSecret: 'test-client-secret' });

    expect(oauthContext.config.clientId).toBe('test-client-id');
    expect(oauthContext.fetch).toBeDefined();
    expect(oauthContext.fetchJson).toBeDefined();
  });

  it('should build a context whose fetch resolves against the api base', async () => {
    const requests: Request[] = [];

    const fetchHandler: FetchHandler = async (request) => {
      requests.push(request);
      return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { oauthContext } = discordOAuthFactory({ fetchHandler })({ clientId: 'test-client-id', clientSecret: 'test-client-secret' });
    await oauthContext.fetchJson('/oauth2/token', { method: 'POST' });

    expect(requests[0].url).toBe('https://discord.com/api/v10/oauth2/token');
  });
});
