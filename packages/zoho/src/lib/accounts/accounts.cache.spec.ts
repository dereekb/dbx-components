import { addSeconds } from 'date-fns';
import { type ZohoAccessToken, type ZohoServiceAccessTokenKey } from './accounts';
import { type ZohoAccountsAccessTokenCacheService, memoryZohoAccountsAccessTokenCacheService, mergeZohoAccountsAccessTokenCacheServices } from './accounts.cache';

describe('mergeZohoAccountsAccessTokenCacheServices()', () => {
  describe('instance', () => {
    const DUMMY_TOKEN_RESULT = {
      accessToken: 'test',
      expiresIn: 3600,
      expiresAt: addSeconds(new Date(), 3600),
      apiDomain: 'domain',
      scope: 'test'
    };

    let tokenToReturn: ZohoAccessToken | undefined;

    let cachedValueA: ZohoAccessToken | undefined;
    let cachedValueB: ZohoAccessToken | undefined;

    beforeEach(() => {
      tokenToReturn = DUMMY_TOKEN_RESULT;
      cachedValueA = undefined;
      cachedValueB = undefined;
    });

    const instance = mergeZohoAccountsAccessTokenCacheServices([
      {
        // never return a value...
        loadZohoAccessTokenCache: (service: ZohoServiceAccessTokenKey) => ({
          loadCachedToken: async () => undefined,
          updateCachedToken: async (x) => {
            cachedValueA = x;
          },
          clearCachedToken: async () => {
            cachedValueA = undefined;
          }
        })
      },
      {
        // always return an expired token...
        loadZohoAccessTokenCache: (service: ZohoServiceAccessTokenKey) => ({
          loadCachedToken: async () => {
            return {
              ...DUMMY_TOKEN_RESULT,
              expiresAt: new Date(Date.now() - 1000) // expired 1 second ago
            };
          },
          updateCachedToken: async (_x) => {
            /* noop */
          },
          clearCachedToken: async () => {
            /* noop */
          }
        })
      },
      memoryZohoAccountsAccessTokenCacheService(),
      // always return tokenToReturn
      {
        loadZohoAccessTokenCache: (service: ZohoServiceAccessTokenKey) => ({
          loadCachedToken: async () => tokenToReturn,
          updateCachedToken: async (x) => {
            cachedValueB = x;
          },
          clearCachedToken: async () => {
            cachedValueB = undefined;
          }
        })
      },
      {
        // always throw an error when updating the cache
        loadZohoAccessTokenCache: (service: ZohoServiceAccessTokenKey) => ({
          loadCachedToken: async () => undefined,
          updateCachedToken: async (_x) => {
            throw new Error('test test test');
          },
          clearCachedToken: async () => {
            /* noop */
          }
        })
      }
    ]);

    it('should try all services when retrieving a token', async () => {
      const randomServiceName = `SERVICE_${Math.floor(Math.random() * 100000)}`;
      const result = await instance.loadZohoAccessTokenCache(randomServiceName).loadCachedToken();

      expect(result).toBeDefined();

      if (result) {
        expect(result.accessToken).toBe(DUMMY_TOKEN_RESULT.accessToken);
        expect(result.expiresIn).toBe(DUMMY_TOKEN_RESULT.expiresIn);
        expect(result.expiresAt).toBeSameSecondAs(DUMMY_TOKEN_RESULT.expiresAt);
        expect(result.apiDomain).toBe(DUMMY_TOKEN_RESULT.apiDomain);
        expect(result.scope).toBe(DUMMY_TOKEN_RESULT.scope);
      }
    });

    it('should never return an expired token even if a service returns an expired token', async () => {
      const randomServiceName = `SERVICE_${Math.floor(Math.random() * 100000)}`;
      tokenToReturn = {
        ...DUMMY_TOKEN_RESULT,
        expiresAt: new Date(Date.now() - 1000)
      };

      expect(tokenToReturn.expiresAt).toBeBefore(new Date());

      let result = await instance.loadZohoAccessTokenCache(randomServiceName).loadCachedToken();
      expect(result).toBeUndefined();

      tokenToReturn = DUMMY_TOKEN_RESULT;

      result = await instance.loadZohoAccessTokenCache(randomServiceName).loadCachedToken();
      expect(result).toBeDefined();
    });

    it('should update all services when updating a token', async () => {
      const randomServiceName = `SERVICE_${Math.floor(Math.random() * 100000)}`;
      const cache = instance.loadZohoAccessTokenCache(randomServiceName);

      await cache.updateCachedToken(DUMMY_TOKEN_RESULT);

      expect(cachedValueA).toBe(DUMMY_TOKEN_RESULT);
      expect(cachedValueB).toBe(DUMMY_TOKEN_RESULT);

      // this one should return the result from the memory cache
      const resultFromMemory = await cache.loadCachedToken();
      expect(resultFromMemory).toBe(DUMMY_TOKEN_RESULT);
    });
  });
});

describe('memoryZohoAccountsAccessTokenCacheService()', () => {
  function token(accessToken: string): ZohoAccessToken {
    return { accessToken, apiDomain: 'https://www.zohoapis.com', scope: 'ZohoRecruit.modules.ALL', expiresIn: 3600, expiresAt: addSeconds(new Date(), 3600) };
  }

  it('should load an entry of the initial record', async () => {
    const initial = token('initial');
    const service = memoryZohoAccountsAccessTokenCacheService({ recruit: initial, crm: undefined });

    expect(await service.loadZohoAccessTokenCache('recruit').loadCachedToken()).toBe(initial);
    expect(await service.loadZohoAccessTokenCache('crm').loadCachedToken()).toBeUndefined();
  });

  it('should update and clear the token per key', async () => {
    const service = memoryZohoAccountsAccessTokenCacheService();
    const recruitCache = service.loadZohoAccessTokenCache('recruit');
    const crmCache = service.loadZohoAccessTokenCache('crm');
    const recruitToken = token('recruit');
    const crmToken = token('crm');

    await recruitCache.updateCachedToken(recruitToken);
    await crmCache.updateCachedToken(crmToken);

    expect(await recruitCache.loadCachedToken()).toBe(recruitToken);
    expect(await crmCache.loadCachedToken()).toBe(crmToken);

    await recruitCache.clearCachedToken();

    expect(await recruitCache.loadCachedToken()).toBeUndefined();
    expect(await crmCache.loadCachedToken()).toBe(crmToken);
  });

  it('should share one record across the caches it loads for the same key', async () => {
    const service = memoryZohoAccountsAccessTokenCacheService();
    const recruitToken = token('recruit');

    await service.loadZohoAccessTokenCache('recruit').updateCachedToken(recruitToken);

    expect(await service.loadZohoAccessTokenCache('recruit').loadCachedToken()).toBe(recruitToken);
  });

  it('should be usable where a ZohoAccountsAccessTokenCacheService is expected', () => {
    const service: ZohoAccountsAccessTokenCacheService = memoryZohoAccountsAccessTokenCacheService();
    expect(typeof service.loadZohoAccessTokenCache).toBe('function');
  });
});
