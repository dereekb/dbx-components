import { appZohoRecruitModuleMetadata } from './recruit.module';
import { DynamicModule, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZohoRecruitApi } from './recruit.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';
import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';
import {
  ZOHO_DUPLICATE_DATA_ERROR_CODE,
  ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE,
  NewZohoRecruitRecordData,
  ZohoRecruitRecordCrudDuplicateDataError,
  ZohoRecruitRecordCrudMandatoryFieldNotFoundError,
  ZohoRecruitRecordNoContentError,
  ZohoRecruitRecord,
  ZohoRecruitRecordCrudNoMatchingRecordError,
  ZOHO_INVALID_DATA_ERROR_CODE,
  ZohoInvalidQueryError,
  ZohoRecruitRecordId,
  ZOHO_RECRUIT_CANDIDATES_MODULE,
  ZohoServerFetchResponseError,
  ZohoRecruitUpdateRecordData,
  ZohoRecruitUpsertRecordData,
  ZOHO_ERROR_STATUS,
  ZOHO_RECRUIT_TAG_NAME_MAX_LENGTH
} from '@dereekb/zoho';
import { Getter, cachedGetter, randomNumber } from '@dereekb/util';

// NOTE: Should have test canidates available on the Zoho Sandbox that is being used. Use test_candidates.csv to generate if needed.

const cacheService = fileZohoAccountsAccessTokenCacheService();

const NON_EXISTENT_CANDIDATE_ID = '576777777777777712';

/**
 * For the tests, atleast one account should have this email domain/suffix.
 */
const TEST_ACCOUNT_EXPORT_SUFFIX = 'components.dereekb.com';
const TEST_ACCOUNT_INSERT_EXPORT_SUFFIX = `insert.${TEST_ACCOUNT_EXPORT_SUFFIX}`;
const TEST_ACCOUNT_UPSERT_EXPORT_SUFFIX = `upsert.${TEST_ACCOUNT_EXPORT_SUFFIX}`;

/**
 * This candidate is only avaialble within the specific testing sandbox used for tests.
 */
const TEST_CANDIDATE_ID = '576214000000574340';
const TEST_CANDIDATE_EMAIL_ADDRESS = 'tester@components.dereekb.com';
const UPSERT_TEST_FIRST_NAME_PREFIX = `Upsert`;
const UPSERT_TEST_LAST_NAME = `Upsert`;

interface TestCandidate extends ZohoRecruitRecord {
  Email: string; // required field
  First_Name?: string; // not required
  Last_Name: string;
  Associated_Tags?: string[];
}

jest.setTimeout(12000);

@Module(appZohoRecruitModuleMetadata({}))
export class TestZohoRecruitModule {}

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

    const GURANTEED_NUMBER_OF_UPSERT_TEST_RECORDS = 2;

    /**
     * Cached getter across all test runs. These records should always exist and can be used for updating.
     */
    const loadTestRecords: Getter<Promise<ZohoRecruitRecord[]>> = cachedGetter(async () => {
      const upsertResult = await api.upsertRecord<TestCandidate>({
        module: ZOHO_RECRUIT_CANDIDATES_MODULE,
        data: [
          {
            First_Name: `${UPSERT_TEST_FIRST_NAME_PREFIX}_1`,
            Last_Name: UPSERT_TEST_LAST_NAME,
            Email: `upsert+1@${TEST_ACCOUNT_UPSERT_EXPORT_SUFFIX}`
          },
          {
            First_Name: `${UPSERT_TEST_FIRST_NAME_PREFIX}_2`,
            Last_Name: UPSERT_TEST_LAST_NAME,
            Email: `upsert+2@${TEST_ACCOUNT_UPSERT_EXPORT_SUFFIX}`
          }
        ]
      });

      return upsertResult.successItems.map((item) => item.result.details);
    });

    beforeEach(() => {
      api = nest.get(ZohoRecruitApi);
    });

    describe('records', () => {
      describe('create', () => {
        describe('insertRecord()', () => {
          describe('single record', () => {
            it('should create a new record and return the change object details result directly', async () => {
              const createNumber = randomNumber({ min: 1000000000000, max: 10000000000000 });

              const result = await api.insertRecord<TestCandidate>({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                data: {
                  First_Name: `Create_${createNumber}`,
                  Last_Name: 'Candidate',
                  Email: `create+${createNumber + 1}@${TEST_ACCOUNT_INSERT_EXPORT_SUFFIX}`
                }
              });

              expect(result).toBeDefined();
              expect(result.id).toBeDefined();
            });

            it('should mark the object error if the input data is invalud for the object', async () => {
              const result = await api.insertRecord<TestCandidate>({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                data: [
                  {
                    First_Name: `Failure`,
                    lastNameFieldMissing: 'Candidate' // invalid field
                  } as any
                ]
              });

              expect(result.errorItems).toHaveLength(1);
              expect(result.errorItems[0].result.code).toBe(ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE);
            });

            itShouldFail('if the input data is invalid for the object', async () => {
              await expectFail(
                () =>
                  api.insertRecord<TestCandidate>({
                    module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                    data: {
                      First_Name: `Failure`,
                      lastNameFieldMissing: 'Candidate' // invalid field
                    } as any
                  }),
                jestExpectFailAssertErrorType(ZohoRecruitRecordCrudMandatoryFieldNotFoundError)
              );
            });

            itShouldFail('if the input has a duplicate unique value in Zoho Recruit.', async () => {
              await expectFail(
                () =>
                  api.insertRecord<TestCandidate>({
                    module: ZOHO_RECRUIT_CANDIDATES_MODULE,
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

              const result = await api.insertRecord<TestCandidate>({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
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

              const data: NewZohoRecruitRecordData<TestCandidate>[] = [
                {
                  First_Name: `Create_${createNumber}`,
                  lastNameFieldMissing: 'Candidate', // field does not exist!
                  Email: `create+${createNumber}@${TEST_ACCOUNT_INSERT_EXPORT_SUFFIX}`
                } as any, // cast to avoid type checking
                {
                  First_Name: `Create_${createNumber + 1}`,
                  Last_Name: 'Candidate',
                  Email: TEST_CANDIDATE_EMAIL_ADDRESS // candidate exists
                }
              ];

              const result = await api.insertRecord<TestCandidate>({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
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

        describe('updateRecord()', () => {
          describe('single record', () => {
            it('should update a record and return the updated record details', async () => {
              const testRecords = await loadTestRecords();
              const recordToUpdate = testRecords[0];

              const number = randomNumber({ min: 1000000000000, max: 10000000000000 });
              const First_Name = `Updated For Test ${number}`;

              const updateResult = await api.updateRecord<TestCandidate>({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                data: {
                  id: recordToUpdate.id,
                  First_Name
                }
              });

              expect(updateResult.id).toBe(recordToUpdate.id);

              const updatedRecord = await api.getRecordById<TestCandidate>({ module: ZOHO_RECRUIT_CANDIDATES_MODULE, id: recordToUpdate.id });
              expect(updatedRecord.First_Name).toBe(First_Name);
            });

            itShouldFail('if attempting to update a value that does not exist', async () => {
              await expectFail(
                () =>
                  api.updateRecord<TestCandidate>({
                    module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                    data: {
                      id: NON_EXISTENT_CANDIDATE_ID,
                      First_Name: 'Failure'
                    }
                  }),
                jestExpectFailAssertErrorType(ZohoRecruitRecordCrudNoMatchingRecordError)
              );
            });

            itShouldFail('if attempting to update a unique value to an existing value', async () => {
              const testRecords = await loadTestRecords();
              const recordToUpdate = testRecords[0];

              await expectFail(
                () =>
                  api.updateRecord<TestCandidate>({
                    module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                    data: {
                      id: recordToUpdate.id,
                      Email: TEST_CANDIDATE_EMAIL_ADDRESS
                    }
                  }),
                jestExpectFailAssertErrorType(ZohoRecruitRecordCrudDuplicateDataError)
              );
            });
          });

          describe('multiple record', () => {
            it('should update multiple records and return the results in an array', async () => {
              const testRecords = await loadTestRecords();
              const recordToUpdate = testRecords[0];

              const number = randomNumber({ min: 1000000000000, max: 10000000000000 });
              const First_Name = `Updated For Test ${number}`;

              const updateResult = await api.updateRecord<TestCandidate>({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                data: [
                  {
                    id: recordToUpdate.id,
                    First_Name
                  }
                ]
              });

              expect(updateResult.successItems).toHaveLength(1);
              expect(updateResult.successItems[0].result.details.id).toBe(recordToUpdate.id);

              const updatedRecord = await api.getRecordById<TestCandidate>({ module: ZOHO_RECRUIT_CANDIDATES_MODULE, id: recordToUpdate.id });
              expect(updatedRecord.First_Name).toBe(First_Name);
            });

            it('should return error items for the items that failed updating', async () => {
              const testRecords = await loadTestRecords();
              const recordToUpdate = testRecords[0];

              const data: ZohoRecruitUpdateRecordData<TestCandidate>[] = [
                {
                  id: NON_EXISTENT_CANDIDATE_ID, // invalid data issue
                  First_Name: 'Failure'
                },
                {
                  id: recordToUpdate.id,
                  Email: TEST_CANDIDATE_EMAIL_ADDRESS // duplicate issue
                }
              ];

              const result = await api.updateRecord<TestCandidate>({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                data
              });

              expect(result.errorItems).toHaveLength(2);
              expect(result.errorItems[0].input).toBe(data[0]);
              expect(result.errorItems[1].input).toBe(data[1]);
              expect(result.errorItems[0].result.code).toBe(ZOHO_INVALID_DATA_ERROR_CODE);
              expect(result.errorItems[1].result.code).toBe(ZOHO_DUPLICATE_DATA_ERROR_CODE);
            });
          });
        });

        describe('upsertRecord()', () => {
          describe('create only', () => {
            describe('single record', () => {
              it('should create a new record and return the updated record details', async () => {
                const number = randomNumber({ min: 1000000000000, max: 10000000000000, round: 'ceil' });
                const Last_Name = `Create For Test ${number}`;

                // inserting a new record, all required fields are required
                const createResult = await api.upsertRecord<TestCandidate>({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  data: {
                    Email: `upsert+${number}@${TEST_ACCOUNT_UPSERT_EXPORT_SUFFIX}`,
                    Last_Name
                  }
                });

                expect(createResult).toBeDefined();
                expect(createResult.id).toBeDefined();
                expect(Array.isArray(createResult)).toBe(false);

                const createdRecord = await api.getRecordById<TestCandidate>({ module: ZOHO_RECRUIT_CANDIDATES_MODULE, id: createResult.id });
                expect(createdRecord.Last_Name).toBe(Last_Name);
              });

              it('should mark the object error if the input data is invalud for the object', async () => {
                const result = await api.upsertRecord<TestCandidate>({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  data: [
                    {
                      First_Name: `Failure`,
                      lastNameFieldMissing: 'Candidate' // invalid field
                    } as any
                  ]
                });

                expect(result.errorItems).toHaveLength(1);
                expect(result.errorItems[0].result.code).toBe(ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE);
              });

              itShouldFail('if the input data is invalid for the object', async () => {
                await expectFail(
                  () =>
                    api.upsertRecord<TestCandidate>({
                      module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                      data: {
                        First_Name: `Failure`,
                        lastNameFieldMissing: 'Candidate' // invalid field
                      } as any
                    }),
                  jestExpectFailAssertErrorType(ZohoRecruitRecordCrudMandatoryFieldNotFoundError)
                );
              });
            });

            describe('multiple records', () => {
              it('should create multiple new records', async () => {
                const createNumber = randomNumber({ min: 1000000000000, max: 10000000000000 });

                const result = await api.upsertRecord<TestCandidate>({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
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

                const data: NewZohoRecruitRecordData<TestCandidate>[] = [
                  {
                    First_Name: `Create_${createNumber}`,
                    lastNameFieldMissing: 'Candidate', // field does not exist!
                    Email: `create+${createNumber}@${TEST_ACCOUNT_INSERT_EXPORT_SUFFIX}`
                  } as any, // cast to avoid type checking
                  {
                    First_Name: `Create_${createNumber + 1}`,
                    Last_Name: 'Candidate',
                    Email: `bademailaddress` // invalid email
                  }
                ];

                const result = await api.upsertRecord<TestCandidate>({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  data
                });

                expect(result.errorItems).toHaveLength(2);
                expect(result.errorItems[0].input).toBe(data[0]);
                expect(result.errorItems[1].input).toBe(data[1]);
                expect(result.errorItems[0].result.code).toBe(ZOHO_MANDATORY_NOT_FOUND_ERROR_CODE);
                expect(result.errorItems[1].result.code).toBe(ZOHO_INVALID_DATA_ERROR_CODE);
              });
            });
          });

          describe('update', () => {
            describe('single record', () => {
              it('should update a record and return the updated record details', async () => {
                const testRecords = await loadTestRecords();
                const recordToUpdate = testRecords[0];

                const number = randomNumber({ min: 1000000000000, max: 10000000000000 });
                const First_Name = `Updated For Test ${number}`;

                const updateResult = await api.upsertRecord<TestCandidate>({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  data: {
                    id: recordToUpdate.id,
                    First_Name
                  }
                });

                expect(updateResult.id).toBe(recordToUpdate.id);

                const updatedRecord = await api.getRecordById<TestCandidate>({ module: ZOHO_RECRUIT_CANDIDATES_MODULE, id: recordToUpdate.id });
                expect(updatedRecord.First_Name).toBe(First_Name);
              });

              itShouldFail('if attempting to update a value that does not exist', async () => {
                await expectFail(
                  () =>
                    api.updateRecord<TestCandidate>({
                      module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                      data: {
                        id: NON_EXISTENT_CANDIDATE_ID,
                        First_Name: 'Failure'
                      }
                    }),
                  jestExpectFailAssertErrorType(ZohoRecruitRecordCrudNoMatchingRecordError)
                );
              });
            });

            describe('multiple record', () => {
              it('should update multiple records and return the results in an array', async () => {
                const testRecords = await loadTestRecords();
                const recordToUpdate = testRecords[0];

                const number = randomNumber({ min: 1000000000000, max: 10000000000000 });
                const First_Name = `Updated For Test ${number}`;

                const updateResult = await api.upsertRecord<TestCandidate>({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  data: [
                    {
                      id: recordToUpdate.id,
                      First_Name
                    }
                  ]
                });

                expect(updateResult.successItems).toHaveLength(1);
                expect(updateResult.successItems[0].result.details.id).toBe(recordToUpdate.id);

                const updatedRecord = await api.getRecordById<TestCandidate>({ module: ZOHO_RECRUIT_CANDIDATES_MODULE, id: recordToUpdate.id });
                expect(updatedRecord.First_Name).toBe(First_Name);
              });

              it('should return error items for the items that failed updating', async () => {
                const testRecords = await loadTestRecords();
                const recordToUpdate = testRecords[0];

                const data: ZohoRecruitUpsertRecordData<TestCandidate>[] = [
                  {
                    id: NON_EXISTENT_CANDIDATE_ID, // invalid data issue
                    First_Name: 'Failure'
                  },
                  {
                    id: recordToUpdate.id,
                    Email: TEST_CANDIDATE_EMAIL_ADDRESS // duplicate issue
                  }
                ];

                const result = await api.upsertRecord({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  data
                });

                expect(result.errorItems).toHaveLength(2);
                expect(result.errorItems[0].input).toBe(data[0]);
                expect(result.errorItems[1].input).toBe(data[1]);
                expect(result.errorItems[0].result.code).toBe(ZOHO_INVALID_DATA_ERROR_CODE);
                expect(result.errorItems[1].result.code).toBe(ZOHO_DUPLICATE_DATA_ERROR_CODE);
              });
            });
          });

          describe('delete', () => {
            let testCandidateRecordId: ZohoRecruitRecordId;

            describe('exists', () => {
              beforeEach(async () => {
                const createNumber = randomNumber({ min: 1000000000000, max: 10000000000000 });

                const result = await api.insertRecord<TestCandidate>({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  data: {
                    First_Name: `Delete_${createNumber}`,
                    Last_Name: 'Candidate',
                    Email: `delete+${createNumber + 1}@${TEST_ACCOUNT_INSERT_EXPORT_SUFFIX}`
                  }
                });

                testCandidateRecordId = result.id;
              });

              it('should delete a record', async () => {
                const deleteResult = await api.deleteRecord({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  ids: testCandidateRecordId
                });

                expect(deleteResult.data).toHaveLength(1);
                expect(deleteResult.successItems).toHaveLength(1);
                expect(deleteResult.successItems[0].details.id).toBe(testCandidateRecordId);
              });
            });

            it('should be successful but return an error for the failed delete', async () => {
              const deleteResult = await api.deleteRecord({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                ids: '12345'
              });

              expect(deleteResult.data).toHaveLength(1);
              expect(deleteResult.errorItems).toHaveLength(1);
              expect(deleteResult.errorItems[0].code).toBe(ZOHO_INVALID_DATA_ERROR_CODE);
              expect(deleteResult.errorItems[0].message).toBe('record not deleted');
              expect(deleteResult.errorItems[0].status).toBe(ZOHO_ERROR_STATUS);
            });
          });

          describe('create and update', () => {
            it('should create new records for those that dont exist and update those that do exist', async () => {
              const testRecords = await loadTestRecords();
              const recordToUpdate = testRecords[0];

              const number = randomNumber({ min: 1000000000000, max: 10000000000000 });
              const First_Name = `Updated For Test ${number}`;

              const createNumber = randomNumber({ min: 1000000000000, max: 10000000000000 });

              const result = await api.upsertRecord<TestCandidate>({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                data: [
                  {
                    First_Name: `Create_${createNumber}`,
                    Last_Name: 'Candidate',
                    Email: `create+${createNumber}@${TEST_ACCOUNT_INSERT_EXPORT_SUFFIX}`
                  },
                  {
                    id: recordToUpdate.id,
                    First_Name
                  }
                ]
              });

              expect(result.errorItems).toHaveLength(0);
              expect(result.successItems).toHaveLength(2);
              expect(result.successItems[0].result.details.id).toBeDefined();
              expect(result.successItems[1].result.details.id).toBeDefined();
              expect(result.successItems[1].result.details.id).toBe(recordToUpdate.id);

              const updatedRecord = await api.getRecordById<TestCandidate>({ module: ZOHO_RECRUIT_CANDIDATES_MODULE, id: recordToUpdate.id });
              expect(updatedRecord.First_Name).toBe(First_Name);
            });
          });
        });
      });

      describe('read', () => {
        let testRecordId: ZohoRecruitRecordId;

        beforeEach(async () => {
          const testRecords = await loadTestRecords();
          const recordToUpdate = testRecords[0];
          testRecordId = recordToUpdate.id;
        });

        describe('getRecordById()', () => {
          it('should return a record', async () => {
            const result = await api.getRecordById({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              id: testRecordId
            });

            expect(result).toBeDefined();
            expect(result.id).toBe(testRecordId);
          });

          itShouldFail('if the record does not exist.', async () => {
            await expectFail(
              () =>
                api.getRecordById({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
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
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              per_page: limit
            });

            expect(result).toBeDefined();
            expect(result.data.length).toBe(limit);
          });
        });

        describe('searchRecords()', () => {
          // This API call suddenly stopped working on Zoho Recruit, so waiting for more info from them.
          /*
          it('should search results by email', async () => {
            const limit = 3;
            const result = await api.searchRecords({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              email: TEST_ACCOUNT_EXPORT_SUFFIX,
              per_page: limit
            });

            expect(result).toBeDefined();
            expect(result.data.length).toBeLessThanOrEqual(limit);
          });
          */

          it('should search results by a specific field', async () => {
            const limit = GURANTEED_NUMBER_OF_UPSERT_TEST_RECORDS;

            const result = await api.searchRecords<TestCandidate>({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              criteria: [{ field: 'Last_Name', filter: 'starts_with', value: UPSERT_TEST_LAST_NAME }],
              per_page: limit
            });

            expect(result).toBeDefined();
            expect(result.data).toHaveLength(GURANTEED_NUMBER_OF_UPSERT_TEST_RECORDS);

            expect(result.data[0].Last_Name).toBe(UPSERT_TEST_LAST_NAME);
            expect(result.data[1].Last_Name).toBe(UPSERT_TEST_LAST_NAME);
          });

          it('should search results by a specific field', async () => {
            const limit = GURANTEED_NUMBER_OF_UPSERT_TEST_RECORDS;

            const result = await api.searchRecords<TestCandidate>({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              criteria: [{ field: 'Last_Name', filter: 'starts_with', value: UPSERT_TEST_LAST_NAME }],
              per_page: limit
            });

            expect(result).toBeDefined();
            expect(result.data).toHaveLength(GURANTEED_NUMBER_OF_UPSERT_TEST_RECORDS);

            expect(result.data[0].Last_Name).toBe(UPSERT_TEST_LAST_NAME);
            expect(result.data[1].Last_Name).toBe(UPSERT_TEST_LAST_NAME);
          });

          it('should return no values if there are no results', async () => {
            const limit = GURANTEED_NUMBER_OF_UPSERT_TEST_RECORDS;

            const result = await api.searchRecords({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              criteria: [{ field: 'Last_Name', filter: 'starts_with', value: 'Should Not Return Any Results' }],
              per_page: limit
            });

            expect(result).toBeDefined();
            expect(result.data).toHaveLength(0);
          });

          itShouldFail('if the criteria is invalid', async () => {
            await expectFail(
              () =>
                api.searchRecords({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  criteria: [
                    {
                      field: 'Last_Name',
                      filter: 'STARTS_WITH_WRONG' as any, // invalid filter type
                      value: 'Should Not Return Any Results'
                    }
                  ]
                }),
              jestExpectFailAssertErrorType(ZohoInvalidQueryError)
            );
          });
        });

        describe('searchRecordsPageFactory()', () => {
          it('should search the pages', async () => {
            const itemsPerPage = 1;
            const fetchPage = api.searchRecordsPageFactory({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              criteria: [{ field: 'Last_Name', filter: 'starts_with', value: UPSERT_TEST_LAST_NAME }],
              per_page: itemsPerPage
            });

            const firstPage = await fetchPage.fetchNext();
            expect(firstPage.page).toBe(0);
            expect(firstPage.result.data).toHaveLength(itemsPerPage);

            const secondPage = await firstPage.fetchNext();
            expect(secondPage.page).toBe(1);
            expect(secondPage.result.data).toHaveLength(itemsPerPage);
          });
        });

        describe('emails', () => {
          describe('getEmailsForRecord()', () => {
            it('should return the list of emails for the record', async () => {
              // No way to add emails, so don't expect any results.
              const result = await api.getEmailsForRecord({ id: testRecordId, module: ZOHO_RECRUIT_CANDIDATES_MODULE });
              expect(result.data).toBeDefined();
            });
          });
        });
      });
    });

    describe('notes', () => {
      describe('record', () => {
        let testRecordId: ZohoRecruitRecordId;

        beforeEach(async () => {
          const testRecords = await loadTestRecords();
          const recordToUpdate = testRecords[0];
          testRecordId = recordToUpdate.id;
        });

        describe('createNotesForRecord()', () => {
          it('should create a new note for the record', async () => {
            const result = await api.createNotesForRecord({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              id: testRecordId,
              notes: {
                Note_Title: 'Test Note',
                Note_Content: `Test Note at ${new Date()}`
              }
            });

            expect(result.errorItems).toHaveLength(0);
            expect(result.successItems).toHaveLength(1);
          });

          it('should fail to create notes for a record that does not exist', async () => {
            const result = await api.createNotesForRecord({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              id: '0',
              notes: {
                Note_Title: 'Test Note',
                Note_Content: `Test Note at ${new Date()}`
              }
            });

            expect(result.errorItems).toHaveLength(1);
            expect(result.successItems).toHaveLength(0);
          });
        });

        describe('getNotesForRecord()', () => {
          beforeEach(async () => {
            const testNotes = await api.getNotesForRecord({ id: testRecordId, module: ZOHO_RECRUIT_CANDIDATES_MODULE });

            if (testNotes.data.length === 0) {
              await api.createNotesForRecord({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                id: testRecordId,
                notes: {
                  Note_Title: 'Test Note',
                  Note_Content: `Test Note at ${new Date()}`
                }
              });
            }
          });

          it('should return the list of notes from the record', async () => {
            const result = await api.getNotesForRecord({ id: testRecordId, module: ZOHO_RECRUIT_CANDIDATES_MODULE });
            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data[0].Parent_Id.id).toBe(testRecordId);

            const allParentIds = new Set(result.data.map((x) => x.Parent_Id.id));
            expect(allParentIds.size).toBe(1);
          });

          itShouldFail('if a record that does not exist is referenced', async () => {
            await expectFail(() => api.getNotesForRecord({ id: '0', module: ZOHO_RECRUIT_CANDIDATES_MODULE }), jestExpectFailAssertErrorType(ZohoServerFetchResponseError));
          });
        });

        describe('deleteNotes()', () => {
          it('should delete a note from the record', async () => {
            const result = await api.createNotesForRecord({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              id: testRecordId,
              notes: {
                Note_Title: 'Test Note For Deleting',
                Note_Content: `Test Note at ${new Date()}`
              }
            });

            expect(result.errorItems).toHaveLength(0);
            expect(result.successItems).toHaveLength(1);

            const newNoteId = result.successItems[0].result.details.id;

            const deleteResult = await api.deleteNotes({
              ids: newNoteId
            });

            expect(deleteResult.errorItems).toHaveLength(0);
            expect(deleteResult.successItems).toHaveLength(1);
          });
        });
      });
    });

    describe('tags', () => {
      describe('createTagsForModule()', () => {
        it('should create a new tag', async () => {
          const randomId = randomNumber(100000000000000);

          const result = await api.createTagsForModule({
            module: ZOHO_RECRUIT_CANDIDATES_MODULE,
            tags: {
              name: `Test ${randomId}`.substring(0, ZOHO_RECRUIT_TAG_NAME_MAX_LENGTH)
            }
          });

          expect(result.errorItems).toHaveLength(0);
          expect(result.successItems).toHaveLength(1);
        });
      });

      describe('getTagsForModule()', () => {
        it('should return the list of tags', async () => {
          const result = await api.getTagsForModule({ module: ZOHO_RECRUIT_CANDIDATES_MODULE });
          expect(result).toBeDefined();
        });
      });

      describe('record', () => {
        const TEST_TAG_NAME = `Test Tag`;

        let testRecordId: ZohoRecruitRecordId;

        beforeEach(async () => {
          const testRecords = await loadTestRecords();
          const recordToUpdate = testRecords[0];
          testRecordId = recordToUpdate.id;
        });

        describe('addTagsToRecords()', () => {
          describe('tag exists', () => {
            beforeEach(async () => {
              await api.createTagsForModule({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                tags: {
                  name: TEST_TAG_NAME
                }
              });
            });

            it('should add a tag to a record', async () => {
              const result = await api.addTagsToRecords({
                module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                tag_names: TEST_TAG_NAME,
                ids: testRecordId
              });

              expect(result.errorItems).toHaveLength(0);
              expect(result.successItems).toHaveLength(1);
            });

            describe('record is tagged', () => {
              beforeEach(async () => {
                await api.addTagsToRecords({
                  module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                  tag_names: TEST_TAG_NAME,
                  ids: testRecordId
                });
              });

              describe('searchRecords()', () => {
                it('should search results by associated tags', async () => {
                  const result = await api.searchRecords<TestCandidate>({
                    module: ZOHO_RECRUIT_CANDIDATES_MODULE,
                    criteria: [{ field: 'Associated_Tags', filter: 'contains', value: TEST_TAG_NAME }]
                  });

                  expect(result).toBeDefined();
                  expect(result.data).not.toHaveLength(0);
                });
              });
            });
          });

          it('should fail if the tag is not known', async () => {
            const result = await api.addTagsToRecords({
              module: ZOHO_RECRUIT_CANDIDATES_MODULE,
              tag_names: `UNKNOWN_TAG_${randomNumber(999999999)}`,
              ids: testRecordId
            });

            expect(result.errorItems).toHaveLength(1);
            expect(result.successItems).toHaveLength(0);
          });
        });
      });

      /*
      describe('record', () => {
        let testRecordId: ZohoRecruitRecordId;

        beforeEach(async () => {
          const testRecords = await loadTestRecords();
          const recordToUpdate = testRecords[0];
          testRecordId = recordToUpdate.id;
        });

        it('should add a tag to a record', async () => {
          const result = await api.addTagToRecord({
            module: ZOHO_RECRUIT_CANDIDATES_MODULE,
            ids: testRecordId,
            tags: 'Test Tag'
          });

          expect(result.errorItems).toHaveLength(0);
          expect(result.successItems).toHaveLength(1);
        });

      });
      */
    });

    describe('REST API Functions', () => {
      // NOTE: Requires the ZohoRecruit.functions.execute.READ to be

      describe('executeRestApiFunction()', () => {
        it('should execute the function', async () => {
          const testFunctionName = 'test';
          const result = await api.executeRestApiFunction({ functionName: testFunctionName });

          expect(result).toBeDefined();
        });
      });
    });
  });
});
