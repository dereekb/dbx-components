import { appZohoRecruitModuleMetadata } from './recruit.module';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZOHO_RECRUIT_SERVICE_NAME } from '@dereekb/zoho';
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
export class TestZohoDependencyModule {}

// example of providing the dependency module
@Module(appZohoRecruitModuleMetadata({ dependencyModule: TestZohoDependencyModule }))
export class TestZohoRecruitModule {}

describe('appZohoRecruitModuleMetadata()', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers: Provider[] = [];

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
  });
});
