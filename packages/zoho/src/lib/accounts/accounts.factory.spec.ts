import { describe, it, expect, vi } from 'vitest';
import { MS_IN_HOUR } from '@dereekb/util';
import { zohoAccountsFactory } from './accounts.factory';
import { type ZohoAccessToken, type ZohoAccessTokenCache, type ZohoAccessTokenRefresher } from './accounts';

function makeToken(accessToken: string): ZohoAccessToken {
  return {
    accessToken,
    scope: 'ZohoCRM.modules.ALL',
    apiDomain: 'https://www.zohoapis.eu',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + MS_IN_HOUR)
  };
}

function makeExternalTokenRefresher(): ZohoAccessTokenRefresher & { readonly calls: () => number } {
  let count = 0;
  const refresher = (async () => {
    count += 1;
    return makeToken(`external-${count}`);
  }) as ZohoAccessTokenRefresher & { calls: () => number };

  refresher.resetAccessToken = vi.fn(async () => undefined);
  refresher.calls = () => count;
  return refresher;
}

function makeMemoryTokenCache(initial?: ZohoAccessToken): ZohoAccessTokenCache & { readonly current: () => ZohoAccessToken | undefined } {
  let stored = initial;

  return {
    loadCachedToken: async () => stored,
    updateCachedToken: async (token) => {
      stored = token;
    },
    clearCachedToken: vi.fn(async () => {
      stored = undefined;
    }),
    current: () => stored
  };
}

describe('zohoAccountsFactory()', () => {
  const factory = zohoAccountsFactory({});

  describe('without a tokenRefresher', () => {
    it('should require a refresh token', () => {
      expect(() => factory({ refreshToken: '', clientId: 'id', clientSecret: 'secret' })).toThrow('missing refreshToken');
    });

    it('should require a client id and secret', () => {
      expect(() => factory({ refreshToken: 'token', clientId: '', clientSecret: 'secret' })).toThrow('missing clientId');
      expect(() => factory({ refreshToken: 'token', clientId: 'id', clientSecret: '' })).toThrow('missing clientSecret');
    });

    it('should leave the access token cache alone on reset', async () => {
      const accessTokenCache = makeMemoryTokenCache(makeToken('cached'));
      const { accountsContext } = factory({ refreshToken: 'token', clientId: 'id', clientSecret: 'secret', accessTokenCache });

      expect((await accountsContext.loadAccessToken()).accessToken).toBe('cached');
      await accountsContext.loadAccessToken.resetAccessToken();

      expect(accessTokenCache.clearCachedToken).not.toHaveBeenCalled();
      expect(accessTokenCache.current()?.accessToken).toBe('cached');
    });
  });

  describe('with a tokenRefresher', () => {
    it('should build a client from empty credentials', () => {
      const tokenRefresher = makeExternalTokenRefresher();
      expect(() => factory({ refreshToken: '', clientId: '', clientSecret: '', apiUrl: 'eu', tokenRefresher })).not.toThrow();
    });

    it('should load access tokens from the external source and keep the resolved accounts url', async () => {
      const tokenRefresher = makeExternalTokenRefresher();
      const { accountsContext } = factory({ refreshToken: '', clientId: '', clientSecret: '', apiUrl: 'eu', tokenRefresher });

      expect((await accountsContext.loadAccessToken()).accessToken).toBe('external-1');
      expect((await accountsContext.loadAccessToken()).accessToken).toBe('external-1');
      expect(tokenRefresher.calls()).toBe(1);
      expect(accountsContext.config.apiUrl).toBe('https://accounts.zoho.eu');
    });

    it('should re-run the source after a reset', async () => {
      const tokenRefresher = makeExternalTokenRefresher();
      const { accountsContext } = factory({ refreshToken: '', clientId: '', clientSecret: '', tokenRefresher });

      expect((await accountsContext.loadAccessToken()).accessToken).toBe('external-1');
      await accountsContext.loadAccessToken.resetAccessToken();

      expect(tokenRefresher.resetAccessToken).toHaveBeenCalledTimes(1);
      expect((await accountsContext.loadAccessToken()).accessToken).toBe('external-2');
      expect(tokenRefresher.calls()).toBe(2);
    });

    it('should clear the access token cache on reset so a rejected token is not reused', async () => {
      const tokenRefresher = makeExternalTokenRefresher();
      const accessTokenCache = makeMemoryTokenCache(makeToken('rejected'));
      const { accountsContext } = factory({ refreshToken: '', clientId: '', clientSecret: '', tokenRefresher, accessTokenCache });

      expect((await accountsContext.loadAccessToken()).accessToken).toBe('rejected');
      await accountsContext.loadAccessToken.resetAccessToken();

      expect(accessTokenCache.clearCachedToken).toHaveBeenCalledTimes(1);
      expect((await accountsContext.loadAccessToken()).accessToken).toBe('external-1');
      expect(accessTokenCache.current()?.accessToken).toBe('external-1');
    });
  });
});
