import { addSeconds } from 'date-fns';
import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ZoomOAuthAccessTokenCacheService, fileZoomOAuthAccessTokenCacheService, memoryZoomOAuthAccessTokenCacheService, mergeZoomOAuthAccessTokenCacheServices } from './oauth.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ZoomAccessToken, ZoomOAuthAccessTokenError } from '@dereekb/zoom';
import { appZoomOAuthModuleMetadata } from './oauth.module';
import { ZoomOAuthApi } from './oauth.api';

const cacheService = fileZoomOAuthAccessTokenCacheService();

@Module(appZoomOAuthModuleMetadata({}))
class TestZoomOAuthModule {}

describe('oauth.service', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    // example of providing the cache service at the root/globally
    const providers: Provider[] = [
      {
        provide: ZoomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestZoomOAuthModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  describe('ZoomOAuthApi', () => {
    let api: ZoomOAuthApi;

    beforeEach(() => {
      api = nest.get(ZoomOAuthApi);
    });

    it('should exist and be properly configured (test environment is properly configured)', () => {
      expect(api).toBeDefined();

      const { config } = api.zoomOAuth.oauthContext;
      expect(config.clientId).toBeDefined();
      expect(config.clientSecret).toBeDefined();
    });

    describe('accountsContext', () => {
      describe('loadAccessToken()', () => {
        it('should return a non-expired access token', async () => {
          const result = await api.oauthContext.loadAccessToken();

          expect(result).toBeDefined();
          expect(result.accessToken).toBeDefined();
          expect(result.expiresIn).toBeDefined();
          expect(result.expiresAt).toBeDefined();
          expect(result.expiresAt.getTime()).toBeGreaterThan(new Date().getTime());

          const tokenCache = cacheService.loadZoomAccessTokenCache();
          const cachedToken = await tokenCache.loadCachedToken();
          expect(cachedToken).toBe(result);
        });
      });
    });

    describe('accessToken()', () => {
      describe('refresh token errors', () => {
        itShouldFail('with an ZoomOAuthAccessTokenError if refresh fails.', async () => {
          await expectFail(() => api.userAccessToken({ refreshToken: 'invalidCode' }), jestExpectFailAssertErrorType(ZoomOAuthAccessTokenError));
        });
      });
    });
  });
});

describe('mergeZoomOAuthAccessTokenCacheServices()', () => {
  describe('instance', () => {
    const DUMMY_TOKEN_RESULT = {
      accessToken: 'test',
      expiresIn: 3600,
      expiresAt: addSeconds(new Date(), 3600),
      apiDomain: 'domain',
      scope: 'test'
    };

    let tokenToReturn: ZoomAccessToken | undefined;

    let cachedValueA: ZoomAccessToken | undefined;
    let cachedValueB: ZoomAccessToken | undefined;

    beforeEach(() => {
      tokenToReturn = DUMMY_TOKEN_RESULT;
      cachedValueA = undefined;
      cachedValueB = undefined;
    });

    const instance = mergeZoomOAuthAccessTokenCacheServices([
      {
        // never return a value...
        loadZoomAccessTokenCache: () => ({
          loadCachedToken: async () => undefined,
          updateCachedToken: async (x) => {
            cachedValueA = x;
          }
        })
      },
      {
        // always return an expired token...
        loadZoomAccessTokenCache: () => ({
          loadCachedToken: async () => {
            return {
              ...DUMMY_TOKEN_RESULT,
              expiresAt: new Date(Date.now() - 1000) // expired 1 second ago
            };
          },
          updateCachedToken: async (x) => {}
        })
      },
      memoryZoomOAuthAccessTokenCacheService(),
      // always return tokenToReturn
      {
        loadZoomAccessTokenCache: () => ({
          loadCachedToken: async () => tokenToReturn,
          updateCachedToken: async (x) => {
            cachedValueB = x;
          }
        })
      },
      {
        // always throw an error when updating the cache
        loadZoomAccessTokenCache: () => ({
          loadCachedToken: async () => undefined,
          updateCachedToken: async (x) => {
            throw new Error('test test test');
          }
        })
      }
    ]);

    it('should try all services when retrieving a token', async () => {
      const result = await instance.loadZoomAccessTokenCache().loadCachedToken();

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
      tokenToReturn = {
        ...DUMMY_TOKEN_RESULT,
        expiresAt: new Date(Date.now() - 1000)
      };

      expect(tokenToReturn.expiresAt).toBeBefore(new Date());

      let result = await instance.loadZoomAccessTokenCache().loadCachedToken();
      expect(result).toBeUndefined();

      tokenToReturn = DUMMY_TOKEN_RESULT;

      result = await instance.loadZoomAccessTokenCache().loadCachedToken();
      expect(result).toBeDefined();
    });

    it('should update all services when updating a token', async () => {
      const cache = instance.loadZoomAccessTokenCache();

      await cache.updateCachedToken(DUMMY_TOKEN_RESULT);

      expect(cachedValueA).toBe(DUMMY_TOKEN_RESULT);
      expect(cachedValueB).toBe(DUMMY_TOKEN_RESULT);

      // this one should return the result from the memory cache
      const resultFromMemory = await cache.loadCachedToken();
      expect(resultFromMemory).toBe(DUMMY_TOKEN_RESULT);
    });
  });
});
