import { addSeconds } from 'date-fns';
import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ZohoAccountsAccessTokenCacheService, fileZohoAccountsAccessTokenCacheService, memoryZohoAccountsAccessTokenCacheService, mergeZohoAccountsAccessTokenCacheServices } from './accounts.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ZohoAccountsApi } from './accounts.api';
import { ZOHO_RECRUIT_SERVICE_NAME, ZohoAccessToken, ZohoAccountsAccessTokenError, ZohoServiceAccessTokenKey } from '@dereekb/zoho';
import { appZohoRecruitModuleMetadata } from '../recruit/recruit.module';

const cacheService = fileZohoAccountsAccessTokenCacheService();

@Module(appZohoRecruitModuleMetadata({}))
export class TestZohoRecruitModule {}

describe('accounts.service', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    // example of providing the cache service at the root/globally
    const providers: Provider[] = [
      {
        provide: ZohoAccountsAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestZohoRecruitModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  describe('ZohoAccountsApi', () => {
    let api: ZohoAccountsApi;

    beforeEach(() => {
      api = nest.get(ZohoAccountsApi);
    });

    it('should exist and be properly configured (test environment is properly configured)', () => {
      expect(api).toBeDefined();

      const { config } = api.zohoAccounts.accountsContext;
      expect(config.clientId).toBeDefined();
      expect(config.clientSecret).toBeDefined();
      expect(config.refreshToken).toBeDefined();
    });

    describe('accountsContext', () => {
      describe('loadAccessToken()', () => {
        it('should return a non-expired access token', async () => {
          const result = await api.accountsContext.loadAccessToken();

          expect(result).toBeDefined();
          expect(result.accessToken).toBeDefined();
          expect(result.expiresIn).toBeDefined();
          expect(result.expiresAt).toBeDefined();
          expect(result.expiresAt.getTime()).toBeGreaterThan(new Date().getTime());
          expect(result.apiDomain).toBeDefined();

          const recruitTokenCache = cacheService.loadZohoAccessTokenCache(ZOHO_RECRUIT_SERVICE_NAME);
          const cachedToken = await recruitTokenCache.loadCachedToken();
          expect(cachedToken).toBe(result);
        });
      });
    });

    describe('accessToken()', () => {
      describe('refresh token errors', () => {
        itShouldFail('with an ZohoAccountsAccessTokenError if refresh fails.', async () => {
          await expectFail(() => api.accessToken({ refreshToken: 'invalidCode' }), jestExpectFailAssertErrorType(ZohoAccountsAccessTokenError));
        });
      });
    });
  });
});

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
          updateCachedToken: async (x) => {},
          clearCachedToken: async () => {}
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
          updateCachedToken: async (x) => {
            throw new Error('test test test');
          },
          clearCachedToken: async () => {}
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
