import { ZohoRecruitModule } from './recruit.module';
import { DynamicModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZohoRecruitApi } from './recruit.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';

const cacheService = fileZohoAccountsAccessTokenCacheService();

/**
 * This candidate is only avaialble within the specific testing sandbox used for tests.
 */
const TEST_CANDIDATE_ID = '576214000000569001';

describe('recruit.api', () => {
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

  describe('ZohoRecruitApi', () => {
    let api: ZohoRecruitApi;

    beforeEach(() => {
      api = nest.get(ZohoRecruitApi);
    });

    describe('getRecordById()', () => {
      it('should return a record', async () => {
        const result = await api.getRecordById({
          module: 'Candidates',
          id: TEST_CANDIDATE_ID
        });

        expect(result).toBeDefined();
        expect(result.response.result).toBeDefined();
      });
    });
  });
});
