import { appCalcomModuleMetadata } from './calcom.module';
import { type DynamicModule, Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { CalcomApi, type CalcomApiContextInstance } from './calcom.api';
import { fileCalcomOAuthAccessTokenCacheService, CalcomOAuthAccessTokenCacheService } from '../oauth/oauth.service';
import { appCalcomOAuthModuleMetadata } from '../oauth/oauth.module';
import { expectFail, itShouldFail, expectFailAssertErrorType } from '@dereekb/util/test';
import { type CalcomUser, CalcomServerFetchResponseError } from '@dereekb/calcom';
import { waitForMs } from '@dereekb/util';

const cacheService = fileCalcomOAuthAccessTokenCacheService();

@Module(
  appCalcomOAuthModuleMetadata({
    exports: [CalcomOAuthAccessTokenCacheService],
    providers: [
      {
        provide: CalcomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ]
  })
)
class TestCalcomOAuthModule {}

@Module(appCalcomModuleMetadata({ dependencyModule: TestCalcomOAuthModule }))
class TestCalcomModule {}

/**
 * Wait 0.5 seconds between each test to avoid hitting rate limits.
 */
const spaceOutTesting: () => Promise<void> = () => waitForMs(500);

describe('calcom.api', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers = [
      {
        provide: CalcomOAuthAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestCalcomModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  describe('CalcomApi', () => {
    let api: CalcomApi;
    let instance: CalcomApiContextInstance;
    let meUser: CalcomUser;

    beforeEach(async () => {
      api = nest.get(CalcomApi);
      instance = api.serverContextInstance;

      // only load the user once for all tests
      if (!meUser) {
        const response = await instance.getMe();
        meUser = response.data;
      }
    });

    afterEach(async () => {
      await spaceOutTesting();
    });

    it('should return the same serverInstance on repeated access', () => {
      expect(api.serverContextInstance).toBe(instance);
    });

    // MARK: User
    describe('user', () => {
      describe('getMe()', () => {
        it('should get the current user', async () => {
          const result = await instance.getMe();
          expect(result).toBeDefined();
          expect(result.status).toBe('success');
          expect(result.data).toBeDefined();
          expect(result.data.id).toBeDefined();
          expect(result.data.email).toBeDefined();
        });
      });
    });

    // MARK: Schedules
    describe('schedules', () => {
      describe('getSchedules()', () => {
        it('should get schedules', async () => {
          const result = await instance.getSchedules();
          expect(result).toBeDefined();
          expect(result.status).toBe('success');
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
        });
      });
    });

    // MARK: Event Types
    describe('event types', () => {
      describe('getEventTypes()', () => {
        it('should get event types', async () => {
          const result = await instance.getEventTypes();
          expect(result).toBeDefined();
          expect(result.status).toBe('success');
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
        });
      });

      // NOTE: create/update/delete event type tests are commented out
      // to avoid polluting the test account. Uncomment for manual testing.
      /*
      describe('createEventType()', () => {
        let createdEventTypeId: number | undefined;

        afterEach(async () => {
          if (createdEventTypeId) {
            await instance.deleteEventType(createdEventTypeId).catch(console.error);
            createdEventTypeId = undefined;
          }
        });

        it('should create and delete an event type', async () => {
          const result = await instance.createEventType({
            title: 'Test Event Type',
            slug: `test-event-${Date.now()}`,
            lengthInMinutes: 30
          });

          expect(result).toBeDefined();
          expect(result.data.id).toBeDefined();
          expect(result.data.title).toBe('Test Event Type');

          createdEventTypeId = result.data.id;
        });
      });
      */
    });

    // MARK: Slots
    describe('slots', () => {
      describe('getAvailableSlots()', () => {
        it('should get available slots for an event type', async () => {
          // First get event types to find a valid eventTypeId
          const eventTypes = await instance.getEventTypes();

          if (eventTypes.data.length > 0) {
            const eventTypeId = eventTypes.data[0].id;
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            const result = await api.getAvailableSlots({
              start: now.toISOString(),
              end: nextWeek.toISOString(),
              eventTypeId
            });

            expect(result).toBeDefined();
            expect(result.status).toBe('success');
            expect(result.data).toBeDefined();
          }
        });
      });
    });

    // MARK: Calendars
    describe('calendars', () => {
      describe('getCalendars()', () => {
        it('should get connected calendars', async () => {
          const result = await instance.getCalendars();
          expect(result).toBeDefined();
          expect(result.status).toBe('success');
          expect(result.data).toBeDefined();
          expect(result.data.connectedCalendars).toBeDefined();
          expect(Array.isArray(result.data.connectedCalendars)).toBe(true);
        });
      });
    });

    // MARK: Webhooks
    describe('webhooks', () => {
      describe('getWebhooks()', () => {
        it('should get webhooks', async () => {
          const result = await instance.getWebhooks();
          expect(result).toBeDefined();
          expect(result.status).toBe('success');
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
        });
      });

      // NOTE: create/update/delete webhook tests are commented out
      // to avoid creating real webhooks on the test account. Uncomment for manual testing.
      /*
      describe('createWebhook()', () => {
        let createdWebhookId: number | undefined;

        afterEach(async () => {
          if (createdWebhookId) {
            await instance.deleteWebhook(createdWebhookId).catch(console.error);
            createdWebhookId = undefined;
          }
        });

        it('should create and delete a webhook', async () => {
          const result = await instance.createWebhook({
            subscriberUrl: 'https://example.com/webhook/calcom-test',
            triggers: ['BOOKING_CREATED', 'BOOKING_CANCELLED'],
            active: false
          });

          expect(result).toBeDefined();
          expect(result.data.id).toBeDefined();
          expect(result.data.subscriberUrl).toBe('https://example.com/webhook/calcom-test');

          createdWebhookId = result.data.id;
        });
      });
      */
    });

    // MARK: Bookings
    describe('bookings', () => {
      describe('getBooking()', () => {
        itShouldFail('to get a booking that does not exist', async () => {
          await expectFail(() => instance.getBooking('non-existent-uid-12345'), expectFailAssertErrorType(CalcomServerFetchResponseError));
        });
      });

      // NOTE: create/cancel booking tests are commented out
      // to avoid creating real bookings. Uncomment for manual testing.
      /*
      describe('createBooking()', () => {
        let cleanupBookingUid: string | undefined;

        afterEach(async () => {
          if (cleanupBookingUid) {
            await instance.cancelBooking({ uid: cleanupBookingUid }).catch(console.error);
            cleanupBookingUid = undefined;
          }
        });

        it('should create a new booking', async () => {
          const eventTypes = await instance.getEventTypes();
          expect(eventTypes.data.length).toBeGreaterThan(0);

          const eventTypeId = eventTypes.data[0].id;

          // Find an available slot
          const now = new Date();
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          const slots = await api.getAvailableSlots({
            start: now.toISOString(),
            end: nextWeek.toISOString(),
            eventTypeId
          });

          // Get the first available slot
          const slotDates = Object.keys(slots.data.slots);
          expect(slotDates.length).toBeGreaterThan(0);

          const firstSlot = slots.data.slots[slotDates[0]][0];
          expect(firstSlot).toBeDefined();

          const result = await instance.createBooking({
            start: firstSlot.time,
            eventTypeId,
            attendee: {
              name: 'Test Attendee',
              email: 'test@example.com',
              timeZone: 'America/New_York'
            }
          });

          expect(result).toBeDefined();
          expect(result.data.uid).toBeDefined();
          cleanupBookingUid = result.data.uid;
        });
      });
      */
    });

    // MARK: Context Instance
    describe('makeContextInstance()', () => {
      it('should create a context instance from the server context', () => {
        const contextInstance = api.makeContextInstance(api.calcomServerContext);
        expect(contextInstance).toBeDefined();
        expect(contextInstance.context).toBe(api.calcomServerContext);
      });
    });
  });
});
