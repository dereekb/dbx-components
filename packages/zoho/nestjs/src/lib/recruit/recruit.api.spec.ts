import { ZohoRecruitModule } from './recruit.module';
import { DynamicModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZohoRecruitApi } from './recruit.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';
import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';
import { ZOHO_DUPLICATE_DATA_ERROR_CODE, ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE, ZohoNewRecruitRecord, ZohoRecruitRecordCrudDuplicateDataError, ZohoRecruitRecordCrudMandatoryFieldNotFoundError, ZohoRecruitRecordNoContentError } from '@dereekb/zoho';
import { randomNumber } from '@dereekb/util';

// NOTE: Should have test canidates available on the Zoho Sandbox that is being used. Use test_candidates.csv to generate if needed.

const cacheService = fileZohoAccountsAccessTokenCacheService();

const NON_EXISTENT_CANDIDATE_ID = '01';

/**
 * For the tests, atleast one account should have this email domain/suffix.
 */
const TEST_ACCOUNT_EXPORT_SUFFIX = 'components.dereekb.com';
const TEST_ACCOUNT_INSERT_EXPORT_SUFFIX = `insert.${TEST_ACCOUNT_EXPORT_SUFFIX}`;

/**
 * This candidate is only avaialble within the specific testing sandbox used for tests.
 */
const TEST_CANDIDATE_ID = '576214000000574340';
const TEST_CANDIDATE_EMAIL_ADDRESS = 'tester@components.dereekb.com';

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

    describe('create', () => {
      describe('insertRecord()', () => {
        describe('single record', () => {
          it('should create a new record and return the data directly', async () => {
            const createNumber = randomNumber({ min: 1000000000000, max: 10000000000000 });

            const result = await api.insertRecord({
              module: 'Candidates',
              data: {
                First_Name: `Create_${createNumber}`,
                Last_Name: 'Candidate',
                Email: `create+${createNumber + 1}@${TEST_ACCOUNT_INSERT_EXPORT_SUFFIX}`
              }
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
          });

          itShouldFail('if the input is invalid.', async () => {
            await expectFail(
              () =>
                api.insertRecord({
                  module: 'Candidates',
                  data: {
                    First_Name: `Failure`,
                    lastNameFieldMissing: 'Candidate'
                  }
                }),
              jestExpectFailAssertErrorType(ZohoRecruitRecordCrudMandatoryFieldNotFoundError)
            );
          });

          itShouldFail('if the input has a duplicate unique value in Zoho Recruit.', async () => {
            await expectFail(
              () =>
                api.insertRecord({
                  module: 'Candidates',
                  data: {
                    First_Name: `Failure`,
                    Last_Name: 'Candidate',
                    Email: TEST_CANDIDATE_EMAIL_ADDRESS
                  }
                }),
              jestExpectFailAssertErrorType(ZohoRecruitRecordCrudDuplicateDataError)
            );
          });
        });

        describe('multiple records', () => {
          it('should create multiple new records', async () => {
            const createNumber = randomNumber({ min: 1000000000000, max: 10000000000000 });

            const result = await api.insertRecord({
              module: 'Candidates',
              data: [
                {
                  First_Name: `Create_${createNumber}`,
                  Last_Name: 'Candidate',
                  Email: `create+${createNumber}@${TEST_ACCOUNT_INSERT_EXPORT_SUFFIX}`
                },
                {
                  First_Name: `Create_${createNumber + 1}`,
                  Last_Name: 'Candidate',
                  Email: `create+${createNumber + 1}@${TEST_ACCOUNT_INSERT_EXPORT_SUFFIX}`
                }
              ]
            });

            expect(result.errorItems).toHaveLength(0);
            expect(result.successItems).toHaveLength(2);
            expect(result.successItems[0].result.details.id).toBeDefined();
            expect(result.successItems[1].result.details.id).toBeDefined();
            expect(result.successItems[0].result.details.id).not.toBe(result.successItems[1].result.details.id);
          });

          it('should return error items for records that could not be created', async () => {
            const createNumber = randomNumber({ min: 1000000000000, max: 10000000000000 });

            const data: ZohoNewRecruitRecord[] = [
              {
                First_Name: `Create_${createNumber}`,
                lastNameFieldMissing: 'Candidate', // field missing
                Email: `create+${createNumber}@${TEST_ACCOUNT_INSERT_EXPORT_SUFFIX}`
              },
              {
                First_Name: `Create_${createNumber + 1}`,
                Last_Name: 'Candidate',
                Email: TEST_CANDIDATE_EMAIL_ADDRESS // candidate exists
              }
            ];

            const result = await api.insertRecord({
              module: 'Candidates',
              data
            });

            expect(result.errorItems).toHaveLength(2);
            expect(result.errorItems[0].input).toBe(data[0]);
            expect(result.errorItems[1].input).toBe(data[1]);
            expect(result.errorItems[0].result.code).toBe(ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE);
            expect(result.errorItems[1].result.code).toBe(ZOHO_DUPLICATE_DATA_ERROR_CODE);
          });
        });
      });
    });

    describe('read', () => {
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
});
