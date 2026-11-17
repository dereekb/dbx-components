import { expectFail, itShouldFail, expectFailAssertErrorType } from '@dereekb/util/test';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { ZohoAccountsAccessTokenCacheService, fileZohoAccountsAccessTokenCacheService, memoryZohoAccountsAccessTokenCacheService, mergeZohoAccountsAccessTokenCacheServices } from './accounts.service';
import { ZohoAccountsAccessTokenCacheService as RootZohoAccountsAccessTokenCacheService, memoryZohoAccountsAccessTokenCacheService as rootMemoryZohoAccountsAccessTokenCacheService, mergeZohoAccountsAccessTokenCacheServices as rootMergeZohoAccountsAccessTokenCacheServices } from '@dereekb/zoho';
import { fileZohoAccountsAccessTokenCacheService as nodeFileZohoAccountsAccessTokenCacheService } from '@dereekb/zoho/node';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZohoAccountsApi } from './accounts.api';
import { ZOHO_RECRUIT_SERVICE_NAME, type ZohoAccessToken, ZohoAccountsAccessTokenError, type ZohoServiceAccessTokenKey } from '@dereekb/zoho';
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
          expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
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
          await expectFail(() => api.accessToken({ refreshToken: 'invalidCode' }), expectFailAssertErrorType(ZohoAccountsAccessTokenError));
        });
      });
    });
  });
});

describe('accounts.service re-exports', () => {
  // the nest-free entries own these now; the NestJS entry must re-export the SAME bindings so the
  // ZohoAccountsAccessTokenCacheService injection token (a class object) is unchanged for NestJS apps
  it('should re-export the same ZohoAccountsAccessTokenCacheService class object from @dereekb/zoho', () => {
    expect(ZohoAccountsAccessTokenCacheService).toBe(RootZohoAccountsAccessTokenCacheService);
  });

  it('should re-export the same cache helpers', () => {
    expect(memoryZohoAccountsAccessTokenCacheService).toBe(rootMemoryZohoAccountsAccessTokenCacheService);
    expect(mergeZohoAccountsAccessTokenCacheServices).toBe(rootMergeZohoAccountsAccessTokenCacheServices);
    expect(fileZohoAccountsAccessTokenCacheService).toBe(nodeFileZohoAccountsAccessTokenCacheService);
  });
});
