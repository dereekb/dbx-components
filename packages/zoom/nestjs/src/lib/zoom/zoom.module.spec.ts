import { appZoomModuleMetadata } from './zoom.module';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { fileZoomOAuthAccessTokenCacheService, ZoomOAuthAccessTokenCacheService } from '../oauth/oauth.service';
import { ZoomOAuthApi } from '../oauth';
import { appZoomOAuthModuleMetadata } from '../oauth/oauth.module';

const cacheService = fileZoomOAuthAccessTokenCacheService();

@Module(
  appZoomOAuthModuleMetadata({
    exports: [ZoomOAuthAccessTokenCacheService],
    providers: [
      {
        provide: ZoomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ]
  })
)
class TestZoomOAuthModule {}

// example of providing the oauth/dependency module
@Module(appZoomModuleMetadata({ dependencyModule: TestZoomOAuthModule }))
class TestZoomModule {}

describe('appZoomModuleMetadata()', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers: Provider[] = [];

    const rootModule: DynamicModule = {
      module: TestZoomModule,
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
      expect(config.accountId).toBeDefined();
      expect(config.accessTokenCache).toBeDefined();
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
          expect(result.apiDomain).toBeDefined();

          const cachedToken = await cacheService.loadZoomAccessTokenCache().loadCachedToken();
          expect(cachedToken).toBe(result);
        });
      });
    });
  });
});
