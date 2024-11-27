import { appZohoRecruitModuleMetadata } from './recruit.module';
import { DynamicModule, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZohoRecruitApi } from './recruit.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';
import {
  ZohoRecruitRecord
} from '@dereekb/zoho';

const cacheService = fileZohoAccountsAccessTokenCacheService();

interface TestCandidate extends ZohoRecruitRecord {
  Email: string; // required field
  First_Name?: string; // not required
  Last_Name: string;
}

@Module(appZohoRecruitModuleMetadata({}))
export class TestZohoRecruitModule {}

describe('recruit.api.limit', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers = [
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

  describe('ZohoRecruitApi', () => {
    let api: ZohoRecruitApi;

    beforeEach(() => {
      api = nest.get(ZohoRecruitApi);
    });

    describe('rate limit test', () => {
      it('should hit the limit on the sandbox', async () => {
        // does nothing. Used only for testing manually.
        /*
        const result = await Promise.all(range(DEFAULT_ZOHO_API_RATE_LIMIT).map(() => {
          return api.searchRecords<TestCandidate>({
            module: ZOHO_RECRUIT_CANDIDATES_MODULE,
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
