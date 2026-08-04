import { addSeconds } from 'date-fns';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CalcomOAuthAccessTokenCacheService, calcomAccessTokenCacheFileKey, fileCalcomOAuthAccessTokenCacheService, memoryCalcomOAuthAccessTokenCacheService, mergeCalcomOAuthAccessTokenCacheServices } from './oauth.service';
import { Test, type TestingModule } from '@nestjs/testing';
import { isCalcomApiKeyCredential, type CalcomAccessToken } from '@dereekb/calcom';
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
      const hasApiKey = config.defaultAuth != null && isCalcomApiKeyCredential(config.defaultAuth);

      // either an api key that IS the token, or a client to exchange a refresh token against
      expect(hasApiKey || config.client != null).toBe(true);
    });

    describe('oauthContext', () => {
      describe('loadAccessToken()', () => {
        it('should return a non-expired access token', async () => {
          const result = await api.oauthContext.loadAccessToken();

          expect(result).toBeDefined();
          expect(result.accessToken).toBeDefined();
          expect(result.expiresAt).toBeDefined();
          expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

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

  describe('cacheForKey', () => {
    it('should be provided when at least one merged service supports it', () => {
      const instance = mergeCalcomOAuthAccessTokenCacheServices([memoryCalcomOAuthAccessTokenCacheService()]);
      expect(instance.cacheForKey).toBeDefined();
    });

    it('should be undefined when no merged service supports it', () => {
      const instance = mergeCalcomOAuthAccessTokenCacheServices([
        {
          loadCalcomAccessTokenCache: () => ({
            loadCachedToken: async () => undefined,
            updateCachedToken: async () => undefined
          })
        }
      ]);

      expect(instance.cacheForKey).toBeUndefined();
    });

    it('should read back a token written under the same key', async () => {
      const instance = mergeCalcomOAuthAccessTokenCacheServices([memoryCalcomOAuthAccessTokenCacheService()]);
      const token: CalcomAccessToken = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, expiresAt: addSeconds(new Date(), 3600), scope: '' };

      await instance.cacheForKey!(STABLE_CACHE_KEY).updateCachedToken(token);

      expect(await instance.cacheForKey!(STABLE_CACHE_KEY).loadCachedToken()).toBe(token);
    });
  });
});

// MARK: Keyed caches
const STABLE_CACHE_KEY = 'profile-id-1234';

/**
 * A token and the token it rotated into, as Cal.com would return across two refreshes.
 */
function rotatingTokens(): { readonly first: CalcomAccessToken; readonly rotated: CalcomAccessToken } {
  const expiresAt = addSeconds(new Date(), 3600);

  return {
    first: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 3600, expiresAt, scope: '' },
    rotated: { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 3600, expiresAt, scope: '' }
  };
}

describe('calcomAccessTokenCacheFileKey()', () => {
  it('should leave an already filesystem-safe key unchanged', () => {
    expect(calcomAccessTokenCacheFileKey('abc123_-XYZ')).toBe('abc123_-XYZ');
  });

  it('should replace unsafe characters and disambiguate with a hash', () => {
    const result = calcomAccessTokenCacheFileKey('a/b');

    expect(result.includes('/')).toBe(false);
    expect(result.startsWith('a_b-')).toBe(true);
  });

  it('should not collapse two different unsafe keys onto the same file key', () => {
    expect(calcomAccessTokenCacheFileKey('a/b')).not.toBe(calcomAccessTokenCacheFileKey('a:b'));
  });
});

describe('memoryCalcomOAuthAccessTokenCacheService()', () => {
  describe('cacheForKey()', () => {
    it('should keep the same entry after the refresh token rotates', async () => {
      const service = memoryCalcomOAuthAccessTokenCacheService();
      const { first, rotated } = rotatingTokens();
      const cache = service.cacheForKey!(STABLE_CACHE_KEY);

      await cache.updateCachedToken(first);
      await cache.updateCachedToken(rotated);

      // the key never moved, so the rotated token is found where the original was stored
      expect(await service.cacheForKey!(STABLE_CACHE_KEY).loadCachedToken()).toBe(rotated);
    });

    it('should isolate entries stored under different keys', async () => {
      const service = memoryCalcomOAuthAccessTokenCacheService();
      const { first, rotated } = rotatingTokens();

      await service.cacheForKey!('key-a').updateCachedToken(first);
      await service.cacheForKey!('key-b').updateCachedToken(rotated);

      expect(await service.cacheForKey!('key-a').loadCachedToken()).toBe(first);
      expect(await service.cacheForKey!('key-b').loadCachedToken()).toBe(rotated);
    });
  });

  describe('cacheForRefreshToken()', () => {
    it('should lose the entry once the rotated token is used as the key (F4)', async () => {
      const service = memoryCalcomOAuthAccessTokenCacheService();
      const { first, rotated } = rotatingTokens();

      // stored under the ORIGINAL refresh token, as a first connect would
      await service.cacheForRefreshToken!(first.refreshToken).updateCachedToken(rotated);

      // a later boot only has the ROTATED token to look up with, which is a different key
      expect(await service.cacheForRefreshToken!(rotated.refreshToken).loadCachedToken()).toBeUndefined();
      // the entry is still there under the old key — orphaned
      expect(await service.cacheForRefreshToken!(first.refreshToken).loadCachedToken()).toBe(rotated);
    });
  });
});
