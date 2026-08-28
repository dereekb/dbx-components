import { appCalcomModuleMetadata } from './calcom.module';
import { type DynamicModule, Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { CalcomApi, type CalcomApiContextInstance } from './calcom.api';
import { fileCalcomOAuthAccessTokenCacheService, CalcomOAuthAccessTokenCacheService } from '../oauth/oauth.service';
import { appCalcomOAuthModuleMetadata } from '../oauth/oauth.module';
import { captureRejection, expectFail, itShouldFail, expectFailAssertErrorType } from '@dereekb/util/test';
import { ALL_CALCOM_WEBHOOK_TIME_RELATIVE_TRIGGERS, ALL_CALCOM_WEBHOOK_TIME_UNITS, ALL_CALCOM_WEBHOOK_VERSIONS, calcomCalendarsToLoadFromConnectedCalendars, calcomWebhookTimeOffsetFromWebhook, CalcomServerFetchResponseError, type CalcomBooking, type CalcomGetCalendarsResponse, type CalcomGetEventTypesResponse, type CalcomUser } from '@dereekb/calcom';
import { type ISO8601DateString, type Maybe, MS_IN_DAY, MS_IN_MINUTE, waitForMs } from '@dereekb/util';

const cacheService = fileCalcomOAuthAccessTokenCacheService();

/**
 * Treat the placeholder values shipped in the committed `.env` as "no credentials".
 *
 * The repo commits `CALCOM_API_KEY=placeholder`, so a bare presence check would never skip.
 */
function real(value: string | undefined): string | undefined {
  return value && value !== 'placeholder' ? value : undefined;
}

/**
 * These tests call the LIVE Cal.com API, so they only run when real credentials are present.
 *
 * Note nx caches test results and no env var is a hash input — pass `--skip-nx-cache` when
 * toggling the key on or off.
 */
const hasCalcomCredentials = Boolean(real(process.env['CALCOM_API_KEY']) ?? real(process.env['CALCOM_CLIENT_ID']));

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

/**
 * Wall-clock allowance for a live test, as the project's 12s `testTimeout` is not enough for a
 * network call that the package may also have to back off and retry after a 429.
 */
const LIVE_TEST_TIMEOUT_MS = 45 * 1000;

/**
 * How far ahead the slot and busy-time reads look.
 */
const READ_AHEAD_DAYS = 14;

/**
 * An ISO8601 day key, as the slots response is keyed by day (`2026-08-13`).
 */
const ISO_DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A schedule availability rule's `startTime`/`endTime` (`09:00`).
 */
const TIME_OF_DAY_REGEX = /^\d{2}:\d{2}$/;

/**
 * A webhook id, which is a UUID rather than one of the numeric ids used elsewhere in the API.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The triggers a webhook time offset may accompany, widened for `includes()`.
 */
const timeRelativeTriggers: readonly string[] = ALL_CALCOM_WEBHOOK_TIME_RELATIVE_TRIGGERS;

/**
 * Asserts a value is a string that parses as a real date.
 *
 * These read-only tests assert this on every date field because the declared type being wrong
 * about a field NAME shows up as `new Date(undefined)` — an Invalid Date, not a type error.
 *
 * @param value - The value expected to be an ISO8601 date string.
 */
function expectIsoDateString(value: unknown): void {
  expect(typeof value).toBe('string');
  expect(new Date(value as string).getTime()).not.toBeNaN();
}

/**
 * Reads the milliseconds a booking/slot range covers.
 *
 * @param start - The start of the range.
 * @param end - The end of the range.
 * @returns The duration of the range in milliseconds.
 */
function rangeDurationMs(start: ISO8601DateString, end: ISO8601DateString): number {
  return new Date(end).getTime() - new Date(start).getTime();
}

/**
 * Read-only validation of the LIVE Cal.com v2 API responses.
 *
 * Every test here only READS, so the suite can be run repeatedly against a real account without
 * leaving anything behind. It asserts FIELD NAMES and value shapes against real payloads rather
 * than `toBeDefined()`, because a hand-written fixture would only encode the same wrong belief
 * that the declared types already hold — several of these assertions exist for a field this
 * package previously declared incorrectly.
 *
 * Expects the credentialed account to have at least one schedule, event type, connected calendar,
 * and booking, and to have availability in the next two weeks.
 */
describe.runIf(hasCalcomCredentials)('calcom.api', () => {
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

    // shared reads, loaded once for every test that needs them to keep the suite inside the rate limit
    let meUser: CalcomUser;
    let eventTypesResponse: Maybe<CalcomGetEventTypesResponse>;
    let calendarsResponse: Maybe<CalcomGetCalendarsResponse>;
    let firstBooking: Maybe<CalcomBooking>;

    /**
     * Loads the account's event types once.
     *
     * @returns The event types response.
     */
    async function loadEventTypes(): Promise<CalcomGetEventTypesResponse> {
      if (!eventTypesResponse) {
        eventTypesResponse = await instance.getEventTypes();
      }

      return eventTypesResponse;
    }

    /**
     * Loads the account's connected calendars once.
     *
     * @returns The calendars response.
     */
    async function loadCalendars(): Promise<CalcomGetCalendarsResponse> {
      if (!calendarsResponse) {
        calendarsResponse = await instance.getCalendars();
      }

      return calendarsResponse;
    }

    /**
     * Loads the account's most recent booking once.
     *
     * @returns The booking.
     */
    async function loadFirstBooking(): Promise<CalcomBooking> {
      if (!firstBooking) {
        const response = await instance.getBookings({ take: 1 });
        firstBooking = response.data[0];
      }

      expect(firstBooking).toBeDefined();
      return firstBooking as CalcomBooking;
    }

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
        it(
          'should get the current user',
          async () => {
            const result = await instance.getMe();
            const user = result.data;

            expect(result.status).toBe('success');
            expect(typeof user.id).toBe('number');
            expect(user.email).toContain('@');
            expect(typeof user.timeZone).toBe('string');
            expect(typeof user.weekStart).toBe('string');
            expect([12, 24]).toContain(user.timeFormat);
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it('should return no createdDate, and carry the organization fields', () => {
          const keys = Object.keys(meUser);

          // /me has no createdDate, despite it once being declared required here
          expect(keys).not.toContain('createdDate');
          expect(keys).toContain('organizationId');
          expect(keys).toContain('defaultScheduleId');

          if (meUser.organization) {
            expect(typeof meUser.organization.id).toBe('number');
            expect(typeof meUser.organization.isPlatform).toBe('boolean');
          }
        });
      });
    });

    // MARK: Schedules
    describe('schedules', () => {
      describe('getSchedules()', () => {
        it(
          'should get schedules with their availability rules',
          async () => {
            const result = await instance.getSchedules();

            expect(result.status).toBe('success');
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data.length).toBeGreaterThan(0);

            result.data.forEach((schedule) => {
              expect(typeof schedule.id).toBe('number');
              expect(typeof schedule.ownerId).toBe('number');
              expect(typeof schedule.name).toBe('string');
              expect(typeof schedule.timeZone).toBe('string');
              expect(typeof schedule.isDefault).toBe('boolean');

              // overrides is an ARRAY, not the date-keyed record it was once declared as
              expect(Array.isArray(schedule.overrides)).toBe(true);
              expect(Array.isArray(schedule.availability)).toBe(true);

              schedule.availability.forEach((rule) => {
                expect(Array.isArray(rule.days)).toBe(true);
                expect(rule.days.length).toBeGreaterThan(0);
                expect(rule.startTime).toMatch(TIME_OF_DAY_REGEX);
                expect(rule.endTime).toMatch(TIME_OF_DAY_REGEX);
              });
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it(
          'should return the schedule the user declares as their default',
          async () => {
            const result = await instance.getSchedules();

            // also asserts both endpoints agree on the type of a schedule id
            if (meUser.defaultScheduleId != null) {
              expect(result.data.map((x) => x.id)).toContain(meUser.defaultScheduleId);
            }
          },
          LIVE_TEST_TIMEOUT_MS
        );
      });
    });

    // MARK: Event Types
    describe('event types', () => {
      describe('getEventTypes()', () => {
        it(
          'should get event types',
          async () => {
            const result = await loadEventTypes();

            expect(result.status).toBe('success');
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data.length).toBeGreaterThan(0);

            result.data.forEach((eventType) => {
              expect(typeof eventType.id).toBe('number');
              expect(typeof eventType.ownerId).toBe('number');
              expect(typeof eventType.title).toBe('string');
              expect(typeof eventType.slug).toBe('string');
              expect(typeof eventType.lengthInMinutes).toBe('number');
              expect(eventType.lengthInMinutes).toBeGreaterThan(0);
              expect(typeof eventType.hidden).toBe('boolean');
              expect(typeof eventType.price).toBe('number');
              expect(typeof eventType.currency).toBe('string');
              expect(Array.isArray(eventType.locations)).toBe(true);
              expect(Array.isArray(eventType.bookingFields)).toBe(true);
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it(
          'should return disableCancelling/disableRescheduling as objects, not booleans',
          async () => {
            const [eventType] = (await loadEventTypes()).data;

            // both are `{ disabled: false }` on the wire, so the bare boolean these were declared
            // as would have made `if (eventType.disableCancelling)` always truthy
            expect(typeof eventType.disableCancelling).toBe('object');
            expect(typeof eventType.disableCancelling.disabled).toBe('boolean');
            expect(typeof eventType.disableRescheduling).toBe('object');
            expect(typeof eventType.disableRescheduling.disabled).toBe('boolean');
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it(
          'should return each toggleable policy as an object',
          async () => {
            const [eventType] = (await loadEventTypes()).data;
            const policies = [eventType.confirmationPolicy, eventType.bookingWindow, eventType.seats, eventType.bookerActiveBookingsLimit];

            policies.forEach((policy) => {
              expect(policy).not.toBeNull();
              expect(typeof policy).toBe('object');
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );
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
      const start = new Date().toISOString();
      const end = new Date(Date.now() + READ_AHEAD_DAYS * MS_IN_DAY).toISOString();

      describe('getAvailableSlots()', () => {
        it(
          'should get available slots for an event type, as a day-keyed map',
          async () => {
            const [eventType] = (await loadEventTypes()).data;
            const result = await api.getAvailableSlots({ start, end, eventTypeId: eventType.id });

            expect(result.status).toBe('success');

            // data IS the day map — at cal-api-version 2024-09-04 there is no `slots` wrapper
            expect((result.data as unknown as { slots?: unknown }).slots).toBeUndefined();

            const days = Object.keys(result.data);
            expect(days.length).toBeGreaterThan(0);

            days.forEach((day) => {
              expect(day).toMatch(ISO_DAY_REGEX);
              expect(Array.isArray(result.data[day])).toBe(true);

              result.data[day].forEach((slot) => {
                expectIsoDateString(slot.start);
                // `time` was the field name this once declared; the API returns `start`
                expect((slot as unknown as { time?: unknown }).time).toBeUndefined();
              });
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it(
          'should return each slot as a range of the event length when the range format is requested',
          async () => {
            const [eventType] = (await loadEventTypes()).data;
            const result = await api.getAvailableSlots({ start, end, eventTypeId: eventType.id, format: 'range' });
            const [slots] = Object.values(result.data);

            expect(slots.length).toBeGreaterThan(0);

            slots.forEach((slot) => {
              expectIsoDateString(slot.start);
              expectIsoDateString(slot.end);
              expect(rangeDurationMs(slot.start, slot.end as ISO8601DateString)).toBe(eventType.lengthInMinutes * MS_IN_MINUTE);
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );
      });
    });

    // MARK: Calendars
    describe('calendars', () => {
      describe('getCalendars()', () => {
        it(
          'should get connected calendars, each with an integration app object',
          async () => {
            const result = await loadCalendars();

            expect(result.status).toBe('success');
            expect(Array.isArray(result.data.connectedCalendars)).toBe(true);
            expect(result.data.connectedCalendars.length).toBeGreaterThan(0);

            result.data.connectedCalendars.forEach((connection) => {
              // integration is app metadata, not the "google_calendar" string carried on each calendar
              expect(typeof connection.integration).toBe('object');
              expect(typeof connection.integration.slug).toBe('string');
              expect(typeof connection.integration.type).toBe('string');
              // installed is omitted for some apps rather than returned as false
              expect(['boolean', 'undefined']).toContain(typeof connection.integration.installed);
              expect(typeof connection.credentialId).toBe('number');
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it(
          'should return primary as a single calendar beside the sibling calendars array',
          async () => {
            const [connection] = (await loadCalendars()).data.connectedCalendars;

            expect(Array.isArray(connection.calendars)).toBe(true);
            expect(connection.calendars.length).toBeGreaterThan(0);

            // primary is ONE calendar, and calendars is its sibling — not primary.calendars
            expect((connection.primary as unknown as { calendars?: unknown }).calendars).toBeUndefined();
            expect(typeof connection.primary?.externalId).toBe('string');

            connection.calendars.forEach((calendar) => {
              expect(typeof calendar.externalId).toBe('string');
              expect(typeof calendar.integration).toBe('string');
              expect(typeof calendar.isSelected).toBe('boolean');
              expect(typeof calendar.readOnly).toBe('boolean');
              expect(typeof calendar.credentialId).toBe('number');
              expect(calendar.email).toContain('@');
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it(
          'should return the destination calendar with its timestamps',
          async () => {
            const { destinationCalendar } = (await loadCalendars()).data;

            if (destinationCalendar) {
              expect(typeof destinationCalendar.id).toBe('number');
              expect(typeof destinationCalendar.integration).toBe('string');
              expect(typeof destinationCalendar.externalId).toBe('string');
              expect(typeof destinationCalendar.userId).toBe('number');
              expectIsoDateString(destinationCalendar.createdAt);
              expectIsoDateString(destinationCalendar.updatedAt);
            }
          },
          LIVE_TEST_TIMEOUT_MS
        );
      });
    });

    // MARK: Busy Times
    describe('busy times', () => {
      const dateFrom = new Date().toISOString();
      const dateTo = new Date(Date.now() + READ_AHEAD_DAYS * MS_IN_DAY).toISOString();

      describe('getBusyTimes()', () => {
        it(
          'should get busy times for the calendars derived from the connected calendars',
          async () => {
            const calendars = await loadCalendars();
            const calendarsToLoad = calcomCalendarsToLoadFromConnectedCalendars(calendars.data.connectedCalendars);

            expect(calendarsToLoad.length).toBeGreaterThan(0);

            const result = await instance.getBusyTimes({ dateFrom, dateTo, timeZone: meUser.timeZone, calendarsToLoad });

            expect(result.status).toBe('success');
            expect(Array.isArray(result.data)).toBe(true);

            result.data.forEach((busyTime) => {
              expectIsoDateString(busyTime.start);
              expectIsoDateString(busyTime.end);
              expect(rangeDurationMs(busyTime.start, busyTime.end)).toBeGreaterThanOrEqual(0);
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );
      });

      describe('getBusyTimesForConnectedCalendars()', () => {
        it(
          'should resolve the calendars to load itself',
          async () => {
            const result = await instance.getBusyTimesForConnectedCalendars({ dateFrom, dateTo, loggedInUsersTz: 'UTC' });

            expect(result.status).toBe('success');
            expect(Array.isArray(result.data)).toBe(true);

            result.data.forEach((busyTime) => {
              expectIsoDateString(busyTime.start);
              expectIsoDateString(busyTime.end);
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );
      });
    });

    // MARK: Webhooks
    describe('webhooks', () => {
      describe('getWebhooks()', () => {
        it(
          'should get webhooks',
          async () => {
            const result = await instance.getWebhooks();

            expect(result.status).toBe('success');
            expect(Array.isArray(result.data)).toBe(true);

            result.data.forEach((webhook) => {
              // the id is a UUID string, not one of the numeric ids used elsewhere in the API
              expect(typeof webhook.id).toBe('string');
              expect(webhook.id).toMatch(UUID_REGEX);
              expect(typeof webhook.active).toBe('boolean');
              expect(typeof webhook.subscriberUrl).toBe('string');
              expect(Array.isArray(webhook.triggers)).toBe(true);

              if (webhook.version != null) {
                expect(ALL_CALCOM_WEBHOOK_VERSIONS).toContain(webhook.version);
              }

              const timeOffset = calcomWebhookTimeOffsetFromWebhook(webhook);

              if (timeOffset) {
                expect(ALL_CALCOM_WEBHOOK_TIME_UNITS).toContain(timeOffset.timeUnit);
                // the API rejects a time below 1, so it never reads one back
                expect(timeOffset.time).toBeGreaterThanOrEqual(1);
                // an offset is only meaningful on a trigger that fires relative to the booking
                expect(webhook.triggers.some((trigger) => timeRelativeTriggers.includes(trigger))).toBe(true);
              }
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );
      });

      describe('getWebhook()', () => {
        itShouldFail('to get a webhook that does not exist', async () => {
          await expectFail(() => instance.getWebhook('00000000-0000-0000-0000-000000000000'), expectFailAssertErrorType(CalcomServerFetchResponseError));
        });
      });

      // NOTE: create/update/delete webhook tests are commented out
      // to avoid creating real webhooks on the test account. Uncomment for manual testing.
      /*
      describe('createWebhook()', () => {
        let createdWebhookId: string | undefined;

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
      describe('getBookings()', () => {
        it(
          'should get a page of bookings, with its pagination',
          async () => {
            const result = await instance.getBookings({ take: 2 });

            expect(result.status).toBe('success');
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data.length).toBeLessThanOrEqual(2);

            const { pagination } = result;
            expect(pagination.itemsPerPage).toBe(2);
            expect(pagination.returnedItems).toBe(result.data.length);
            expect(pagination.currentPage).toBe(1);
            expect(typeof pagination.totalItems).toBe('number');
            expect(typeof pagination.remainingItems).toBe('number');
            expect(typeof pagination.hasNextPage).toBe('boolean');
            expect(typeof pagination.hasPreviousPage).toBe('boolean');
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it(
          'should return start/end that parse as real dates, not startTime/endTime',
          async () => {
            const booking = await loadFirstBooking();

            expectIsoDateString(booking.start);
            expectIsoDateString(booking.end);
            expectIsoDateString(booking.createdAt);

            // the silent bug this replaces: startTime was declared but never returned, so
            // new Date(booking.startTime) yielded an Invalid Date
            expect((booking as unknown as Record<string, unknown>)['startTime']).toBeUndefined();

            // the declared duration and the returned range have to agree
            expect(rangeDurationMs(booking.start, booking.end)).toBe(booking.duration * MS_IN_MINUTE);
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it(
          'should return the booking surface, including its hosts and attendees',
          async () => {
            const booking = await loadFirstBooking();

            expect(typeof booking.id).toBe('number');
            expect(typeof booking.uid).toBe('string');
            expect(typeof booking.title).toBe('string');
            expect(['accepted', 'pending', 'cancelled', 'rejected']).toContain(booking.status);
            expect(typeof booking.eventTypeId).toBe('number');
            expect(typeof booking.eventType.id).toBe('number');
            expect(typeof booking.eventType.slug).toBe('string');
            expect(typeof booking.absentHost).toBe('boolean');
            expect(typeof booking.icsUid).toBe('string');
            expect(Array.isArray(booking.guests)).toBe(true);
            expect(Object.keys(booking)).toContain('meetingUrl');
            expect(Object.keys(booking)).toContain('location');

            expect(booking.hosts.length).toBeGreaterThan(0);
            booking.hosts.forEach((host) => {
              expect(typeof host.id).toBe('number');
              expect(host.email).toContain('@');
              expect(typeof host.timeZone).toBe('string');
            });

            expect(booking.attendees.length).toBeGreaterThan(0);
            booking.attendees.forEach((attendee) => {
              expect(typeof attendee.name).toBe('string');
              expect(attendee.email).toContain('@');
              expect(typeof attendee.timeZone).toBe('string');
              expect(typeof attendee.absent).toBe('boolean');
            });
          },
          LIVE_TEST_TIMEOUT_MS
        );
      });

      describe('getBooking()', () => {
        it(
          'should read back the booking returned by getBookings()',
          async () => {
            const booking = await loadFirstBooking();
            const result = await instance.getBooking(booking.uid);

            expect(result.status).toBe('success');
            expect(result.data.uid).toBe(booking.uid);
            expect(result.data.id).toBe(booking.id);
            expect(result.data.start).toBe(booking.start);
            expect(result.data.end).toBe(booking.end);
          },
          LIVE_TEST_TIMEOUT_MS
        );

        it(
          'should surface the code and message nested under the API error envelope',
          async () => {
            const error = await captureRejection(() => instance.getBooking('non-existent-uid-12345'));

            expect(error).toBeInstanceOf(CalcomServerFetchResponseError);

            const calcomError = error as CalcomServerFetchResponseError;

            // both were silently undefined while the body was read as if it were flat
            expect(calcomError.error.code).toBeDefined();
            expect(typeof calcomError.error.message).toBe('string');
            expect(calcomError.error.message.length).toBeGreaterThan(0);
            expect(calcomError.responseError.response.status).toBe(404);
          },
          LIVE_TEST_TIMEOUT_MS
        );
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
          const slotDates = Object.keys(slots.data);
          expect(slotDates.length).toBeGreaterThan(0);

          const firstSlot = slots.data[slotDates[0]][0];
          expect(firstSlot).toBeDefined();

          const result = await instance.createBooking({
            start: firstSlot.start,
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
