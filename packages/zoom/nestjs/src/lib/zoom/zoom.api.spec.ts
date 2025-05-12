import { appZoomModuleMetadata } from './zoom.module';
import { DynamicModule, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZoomApi } from './zoom.api';
import { fileZoomOAuthAccessTokenCacheService, ZoomOAuthAccessTokenCacheService } from '../oauth/oauth.service';
import { appZoomOAuthModuleMetadata } from '../oauth/oauth.module';
import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';
import { ZoomMeeting, ZoomServerFetchResponseError, ZoomUser } from '@dereekb/zoom';
import { addHours } from 'date-fns';

const cacheService = fileZoomOAuthAccessTokenCacheService();

interface TestCandidate {
  Email: string; // required field
  First_Name?: string; // not required
  Last_Name: string;
}

jest.setTimeout(12000);

@Module(
  appZoomOAuthModuleMetadata({
    exports: [ZoomOAuthAccessTokenCacheService],
    providers: [
      {
        provide: ZoomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ]
  })
)
class TestZoomOAuthModule {}

@Module(appZoomModuleMetadata({ dependencyModule: TestZoomOAuthModule }))
class TestZoomModule {}

describe('zoom.api', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers = [
      {
        provide: ZoomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestZoomModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  describe('ZoomApi', () => {
    let api: ZoomApi;
    let meUser: ZoomUser;

    beforeEach(async () => {
      api = nest.get(ZoomApi);

      // only load the user once for all tests
      if (!meUser) {
        meUser = await api.getUser({ userId: 'me' });
      }
    });

    // MARK: Users
    describe('users', () => {
      describe('getUser()', () => {
        it('should get a user with "me"', async () => {
          const result = await api.getUser({ userId: 'me' });
          expect(result.id).toBeDefined();
          expect(result.email).toBeDefined();
          expect(result).toBeDefined();
        });

        it('should get a user with a valid user ID', async () => {
          const result = await api.getUser({ userId: meUser.id });
          expect(result.id).toBeDefined();
          expect(result.id).toBe(meUser.id);
          expect(result.email).toBeDefined();

          expect(result).toBeDefined();
        });

        itShouldFail('to get a user that does not exist', async () => {
          await expectFail(() => api.getUser({ userId: 'test_id_that_does_not_exist' }), jestExpectFailAssertErrorType(ZoomServerFetchResponseError));
        });
      });

      describe('listUsers()', () => {
        it('should list users', async () => {
          const result = await api.listUsers({});

          expect(result).toBeDefined();
          expect(result.page_count).toBe(1);
          expect(result.page_number).toBe(1);
          expect(result.page_size).toBeDefined();
          expect(result.total_records).toBeGreaterThan(0);
          expect(result.next_page_token).toBeFalsy(); // should only have one page of results
          expect(result.data).toBeDefined();
          expect(result.data.length).toBeGreaterThan(0);
        });
      });

      describe('listUsersPageFactory()', () => {
        it('should list users', async () => {
          const lustUsersPageFactory = api.listUsersPageFactory({});

          const firstPage = await lustUsersPageFactory.fetchNext();
          expect(firstPage).toBeDefined();

          const { result } = firstPage;

          expect(result.page_count).toBe(1);
          expect(result.page_number).toBe(1);
          expect(result.page_size).toBeDefined();
          expect(result.total_records).toBeGreaterThan(0);
          expect(result.next_page_token).toBeFalsy(); // should only have one page of results
          expect(result.data).toBeDefined();
          expect(result.data.length).toBeGreaterThan(0);

          expect(firstPage.hasNext).toBe(false);
        });
      });
    });

    // MARK: Meetings
    describe('meetings', () => {
      describe('user', () => {
        let cleanupMeeting!: ZoomMeeting;

        afterEach(async () => {
          if (cleanupMeeting != null) {
            await api
              .deleteMeeting({
                meetingId: cleanupMeeting.id,
                // do not send messages
                schedule_for_reminder: false,
                cancel_meeting_reminder: false
              })
              .catch((x) => {
                console.error('failed to cleanup meeting', cleanupMeeting.id, x);
              });
          }
        });

        describe('create meeting', () => {
          it('should create a new meeting', async () => {
            const result = await api.createMeetingForUser({
              user: 'me',
              template: {
                topic: 'test',
                type: 2,
                start_time: addHours(new Date(), 1).toISOString(),
                duration: 60
              }
            });

            cleanupMeeting = result;
            expect(result).toBeDefined();
          });
        });

        describe('delete meeting', () => {
          itShouldFail('to delete a meeting that does not exist if silenceError is false', async () => {
            await expectFail(() => api.deleteMeeting({ meetingId: 'test_id_that_does_not_exist', silenceError: false }), jestExpectFailAssertErrorType(ZoomServerFetchResponseError));
          });

          it('should quietly delete a meeting that does not exist if silenceError is true or undefined', async () => {
            await api.deleteMeeting({ meetingId: 'test_id_that_does_not_exist' });
          });
        });

        // No need to constatntly test these. Hit rate limits
        /*
        describe('meeting', () => {
          let meeting!: ZoomMeeting;

          beforeEach(async () => {
            meeting = await api.createMeetingForUser({
              user: 'me',
              template: {
                topic: 'test',
                type: 2,
                start_time: addHours(new Date(), 1).toISOString(),
                duration: 60
              }
            });
            cleanupMeeting = meeting;
          });

          describe('listMeetings()', () => {
            it('should list meetings', async () => {
              const result = await api.listMeetingsForUser({ user: 'me' });

              expect(result).toBeDefined();
              expect(result.page_size).toBeDefined();
              expect(result.total_records).toBeGreaterThan(0);
              expect(result.next_page_token).toBeFalsy(); // should only have one page of results
              expect(result.data).toBeDefined();
              expect(result.data.length).toBeGreaterThan(0);
            });
          });

          describe('listMeetingsPageFactory()', () => {
            it('should list meetings', async () => {
              const listMeetingsPageFactory = api.listMeetingsForUserPageFactory({ user: 'me' });

              const firstPage = await listMeetingsPageFactory.fetchNext();
              expect(firstPage).toBeDefined();

              const { result } = firstPage;

              expect(result.page_size).toBeDefined();
              expect(result.total_records).toBeGreaterThan(0);
              expect(result.next_page_token).toBeFalsy(); // should only have one page of results
              expect(result.data).toBeDefined();
              expect(result.data.length).toBeGreaterThan(0);

              expect(firstPage.hasNext).toBe(false);
            });
          });

          describe('delete', () => {
            it('should delete the meeting', async () => {
              await api.deleteMeeting({
                meetingId: meeting.id,
                // do not send messages
                schedule_for_reminder: false,
                cancel_meeting_reminder: false
              });
            });
          });
        });
        */
      });
    });
  });
});
