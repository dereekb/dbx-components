import { appZohoCrmModuleMetadata } from './crm.module';
import { DynamicModule, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZohoCrmApi } from './crm.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';
import { ZohoCrmRecord } from '@dereekb/zoho';

const cacheService = fileZohoAccountsAccessTokenCacheService();

interface TestCandidate extends ZohoCrmRecord {
  Email: string; // required field
  First_Name?: string; // not required
  Last_Name: string;
}

@Module(appZohoCrmModuleMetadata({}))
export class TestZohoCrmModule {}

describe('crm.api.limit', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers = [
      {
        provide: ZohoAccountsAccessTokenCacheService,
        useValue: cacheService
      }
    ];

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

  describe('ZohoCrmApi', () => {
    let api: ZohoCrmApi;

    beforeEach(() => {
      api = nest.get(ZohoCrmApi);
    });

    describe('rate limit test', () => {
      it('should hit the limit on the sandbox', async () => {
        // does nothing. Used only for testing manually.
        /*
        const result = await Promise.all(range(DEFAULT_ZOHO_API_RATE_LIMIT).map(() => {
          return api.searchRecords<TestCandidate>({
            module: ZOHO_CRM_CANDIDATES_MODULE,
            criteria: [{ field: 'First_Name', filter: 'equals', value: 'test' }]
          });
        }));

        console.log('done...');

        await waitForMs(10000);
        */
      });
    });
  });
});
