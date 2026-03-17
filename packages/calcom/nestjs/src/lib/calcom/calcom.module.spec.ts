import { appCalcomModuleMetadata } from './calcom.module';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { fileCalcomOAuthAccessTokenCacheService, CalcomOAuthAccessTokenCacheService } from '../oauth/oauth.service';
import { CalcomOAuthApi } from '../oauth';
import { appCalcomOAuthModuleMetadata } from '../oauth/oauth.module';

const cacheService = fileCalcomOAuthAccessTokenCacheService();

@Module(
  appCalcomOAuthModuleMetadata({
    exports: [CalcomOAuthAccessTokenCacheService],
    providers: [
      {
        provide: CalcomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ]
  })
)
class TestCalcomOAuthModule {}

// example of providing the oauth/dependency module
@Module(appCalcomModuleMetadata({ dependencyModule: TestCalcomOAuthModule }))
class TestCalcomModule {}

describe('appCalcomModuleMetadata()', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers: Provider[] = [];

    const rootModule: DynamicModule = {
      module: TestCalcomModule,
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
        });
      });
    });
  });
});
