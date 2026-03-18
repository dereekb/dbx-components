import { addSeconds } from 'date-fns';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CalcomOAuthAccessTokenCacheService, fileCalcomOAuthAccessTokenCacheService, memoryCalcomOAuthAccessTokenCacheService, mergeCalcomOAuthAccessTokenCacheServices } from './oauth.service';
import { Test, type TestingModule } from '@nestjs/testing';
import { type CalcomAccessToken } from '@dereekb/calcom';
import { appCalcomOAuthModuleMetadata } from './oauth.module';
import { CalcomOAuthApi } from './oauth.api';

const cacheService = fileCalcomOAuthAccessTokenCacheService();

@Module(appCalcomOAuthModuleMetadata({}))
class TestCalcomOAuthModule {}

describe('oauth.service', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers: Provider[] = [
      {
        provide: CalcomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestCalcomOAuthModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  describe('CalcomOAuthApi', () => {
    let api: CalcomOAuthApi;

    beforeEach(() => {
      api = nest.get(CalcomOAuthApi);
    });

    it('should exist and be properly configured (test environment is properly configured)', () => {
      expect(api).toBeDefined();

      const { config } = api.calcomOAuth.oauthContext;

      // Should have either an API key or OAuth credentials configured
      const hasApiKey = !!config.apiKey;
      const hasOAuth = !!config.clientId && !!config.clientSecret;
      expect(hasApiKey || hasOAuth).toBe(true);
    });

    describe('oauthContext', () => {
      describe('loadAccessToken()', () => {
        it('should return a non-expired access token', async () => {
          const result = await api.oauthContext.loadAccessToken();

          expect(result).toBeDefined();
          expect(result.accessToken).toBeDefined();
          expect(result.expiresAt).toBeDefined();
          expect(result.expiresAt.getTime()).toBeGreaterThan(new Date().getTime());

          const tokenCache = cacheService.loadCalcomAccessTokenCache();
          const cachedToken = await tokenCache.loadCachedToken();

          // When using API key auth, the token won't be cached to file
          if (cachedToken) {
            expect(cachedToken.accessToken).toBe(result.accessToken);
          }
        });
      });
    });
  });
});

describe('mergeCalcomOAuthAccessTokenCacheServices()', () => {
  describe('instance', () => {
    const DUMMY_TOKEN_RESULT: CalcomAccessToken = {
      accessToken: 'test',
      refreshToken: 'test-refresh',
      expiresIn: 3600,
      expiresAt: addSeconds(new Date(), 3600),
      scope: 'test'
    };

    let tokenToReturn: CalcomAccessToken | undefined;

    let cachedValueA: CalcomAccessToken | undefined;
    let cachedValueB: CalcomAccessToken | undefined;

    beforeEach(() => {
      tokenToReturn = DUMMY_TOKEN_RESULT;
      cachedValueA = undefined;
      cachedValueB = undefined;
    });

    const instance = mergeCalcomOAuthAccessTokenCacheServices([
      {
        // never return a value
        loadCalcomAccessTokenCache: () => ({
          loadCachedToken: async () => undefined,
          updateCachedToken: async (x) => {
            cachedValueA = x;
          }
        })
      },
      {
        // always return an expired token
        loadCalcomAccessTokenCache: () => ({
          loadCachedToken: async () => {
            return {
              ...DUMMY_TOKEN_RESULT,
              expiresAt: new Date(Date.now() - 1000) // expired 1 second ago
            };
          },
          updateCachedToken: async () => {
            // noop
          }
        })
      },
      memoryCalcomOAuthAccessTokenCacheService(),
      // always return tokenToReturn
      {
        loadCalcomAccessTokenCache: () => ({
          loadCachedToken: async () => tokenToReturn,
          updateCachedToken: async (x) => {
            cachedValueB = x;
          }
        })
      },
      {
        // always throw an error when updating the cache
        loadCalcomAccessTokenCache: () => ({
          loadCachedToken: async () => undefined,
          updateCachedToken: async () => {
            throw new Error('test test test');
          }
        })
      }
    ]);

    it('should try all services when retrieving a token', async () => {
      const result = await instance.loadCalcomAccessTokenCache().loadCachedToken();

      expect(result).toBeDefined();

      if (result) {
        expect(result.accessToken).toBe(DUMMY_TOKEN_RESULT.accessToken);
        expect(result.refreshToken).toBe(DUMMY_TOKEN_RESULT.refreshToken);
        expect(result.expiresIn).toBe(DUMMY_TOKEN_RESULT.expiresIn);
        expect(result.expiresAt).toBeSameSecondAs(DUMMY_TOKEN_RESULT.expiresAt);
        expect(result.scope).toBe(DUMMY_TOKEN_RESULT.scope);
      }
    });

    it('should never return an expired token even if a service returns an expired token', async () => {
      tokenToReturn = {
        ...DUMMY_TOKEN_RESULT,
        expiresAt: new Date(Date.now() - 1000)
      };

      expect(tokenToReturn.expiresAt).toBeBefore(new Date());

      let result = await instance.loadCalcomAccessTokenCache().loadCachedToken();
      expect(result).toBeUndefined();

      tokenToReturn = DUMMY_TOKEN_RESULT;

      result = await instance.loadCalcomAccessTokenCache().loadCachedToken();
      expect(result).toBeDefined();
    });

    it('should update all services when updating a token', async () => {
      const cache = instance.loadCalcomAccessTokenCache();

      await cache.updateCachedToken(DUMMY_TOKEN_RESULT);

      expect(cachedValueA).toBe(DUMMY_TOKEN_RESULT);
      expect(cachedValueB).toBe(DUMMY_TOKEN_RESULT);

      // this one should return the result from the memory cache
      const resultFromMemory = await cache.loadCachedToken();
      expect(resultFromMemory).toBe(DUMMY_TOKEN_RESULT);
    });
  });
});
