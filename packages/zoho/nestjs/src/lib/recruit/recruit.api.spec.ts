import { ZohoRecruitModule } from './recruit.module';
import { DynamicModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZohoRecruitApi } from './recruit.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';
import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';
import { ZohoRecruitRecordNoContentError } from '@dereekb/zoho';

// NOTE: Should have test canidates available on the Zoho Sandbox that is being used. Use test_candidates.csv to generate if needed.

const cacheService = fileZohoAccountsAccessTokenCacheService();

/**
 * This candidate is only avaialble within the specific testing sandbox used for tests.
 */
const TEST_CANDIDATE_ID = '576214000000574340';

const NON_EXISTENT_CANDIDATE_ID = '01';

/**
 * For the tests, atleast one account should have this email domain/suffix.
 */
const TEST_ACCOUNT_EXPORT_SUFFIX = 'compoents.dereekb.com';

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
        expect(result.id).toBe(TEST_CANDIDATE_ID);
      });

      itShouldFail('if the record does not exist.', async () => {
        await expectFail(
          () =>
            api.getRecordById({
              module: 'Candidates',
              id: NON_EXISTENT_CANDIDATE_ID
            }),
          jestExpectFailAssertErrorType(ZohoRecruitRecordNoContentError)
        );
      });
    });

    describe('getRecords()', () => {
      it('should return a page of records and respect the limit.', async () => {
        const limit = 3;
        const result = await api.getRecords({
          module: 'Candidates',
          per_page: limit
        });

        expect(result).toBeDefined();
        expect(result.data.length).toBe(limit);
      });
    });

    describe('searchRecords()', () => {
      it('should return a page of search results', async () => {
        const limit = 3;
        const result = await api.searchRecords({
          module: 'Candidates',
          email: TEST_ACCOUNT_EXPORT_SUFFIX,
          per_page: limit
        });

        expect(result).toBeDefined();
        expect(result.data.length).toBeLessThanOrEqual(limit);
      });
    });
  });
});
