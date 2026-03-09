import { appZohoCrmModuleMetadata } from './crm.module';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZOHO_CRM_SERVICE_NAME } from '@dereekb/zoho';
import { ZohoAccountsApi } from '../accounts/accounts.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';

const cacheService = fileZohoAccountsAccessTokenCacheService();

@Module({
  providers: [
    {
      provide: ZohoAccountsAccessTokenCacheService,
      useValue: cacheService
    }
  ],
  exports: [ZohoAccountsAccessTokenCacheService]
})
export class TestZohoCrmDependencyModule {}

// example of providing the dependency module
@Module(appZohoCrmModuleMetadata({ dependencyModule: TestZohoCrmDependencyModule }))
export class TestZohoCrmModule {}

// module without the required dependency
@Module(appZohoCrmModuleMetadata({}))
export class TestZohoCrmModuleWithoutDependency {}

describe('appZohoCrmModuleMetadata()', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers: Provider[] = [];

    const rootModule: DynamicModule = {
      module: TestZohoCrmModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  it('should fail to compile when ZohoAccountsAccessTokenCacheService is not provided', async () => {
    const rootModule: DynamicModule = {
      module: TestZohoCrmModuleWithoutDependency,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    await expect(builder.compile()).rejects.toThrow();
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

          const crmTokenCache = cacheService.loadZohoAccessTokenCache(ZOHO_CRM_SERVICE_NAME);
          const cachedToken = await crmTokenCache.loadCachedToken();
          expect(cachedToken).toBe(result);
        });
      });
    });
  });
});
