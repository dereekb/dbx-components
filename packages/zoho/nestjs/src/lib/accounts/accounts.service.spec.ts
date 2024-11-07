import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';
import { ZohoRecruitModule } from './../recruit/recruit.module';
import { DynamicModule } from '@nestjs/common';
import { ZohoAccountsAccessTokenCacheService, fileZohoAccountsAccessTokenCacheService, memoryZohoAccountsAccessTokenCacheService } from './accounts.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ZohoAccountsApi } from './accounts.api';
import { ZOHO_RECRUIT_SERVICE_NAME, ZohoAccountsAccessTokenError } from '@dereekb/zoho';

const cacheService = fileZohoAccountsAccessTokenCacheService();

describe('accounts.service', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers = [
      {
        provide: ZohoAccountsAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: ZohoRecruitModule,
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
