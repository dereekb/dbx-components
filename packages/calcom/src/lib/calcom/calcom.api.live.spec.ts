import { describe, it, expect, beforeAll } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { calcomOAuthFactory } from '../oauth/oauth.factory';
import { calcomFactory } from './calcom.factory';
import { type CalcomServerContext } from './calcom.config';
import { getMe } from './calcom.api.user';
import { type CalcomCalendar, calcomCalendarsToLoadFromConnectedCalendars, getBusyTimes, getBusyTimesForConnectedCalendars, getCalendars } from './calcom.api.calendar';
import { getSchedules } from './calcom.api.schedule';
import { getEventTypes } from './calcom.api.eventtype';
import { getAvailableSlots } from './calcom.api.slot';
import { getBooking } from './calcom.api.booking';
import { type CalcomServerError } from '../calcom.error.api';

/**
 * Treat the placeholder values shipped in the committed `.env` as "no credentials".
 *
 * The repo commits `CALCOM_API_KEY=placeholder`, so `process.env.CALCOM_API_KEY` is never
 * undefined — a bare presence check would never skip.
 */
function real(value: Maybe<string>): Maybe<string> {
  return value && value !== 'placeholder' ? value : undefined;
}

const apiKey = real(process.env['CALCOM_API_KEY']);

/**
 * Wall-clock allowance for a live test. The `calcom` project sets no `testTimeout`, so it would
 * otherwise inherit vitest's 5s default and flake on the network. Generous because the package
 * rate-limits itself and backs off on 429, which can stretch a call well past its normal latency.
 */
const LIVE_TEST_TIMEOUT_MS = 45 * 1000;

/**
 * Builds a server context that talks to the real api.cal.com/v2 with an api key.
 *
 * @param apiKey - The Cal.com api key to authenticate as.
 * @returns The live server context.
 */
function makeLiveCalcomServerContext(apiKey: string): CalcomServerContext {
  const { oauthContext } = calcomOAuthFactory({})({ defaultAuth: { apiKey } });
  const { calcomServerContext } = calcomFactory({ oauthContext })({});
  return calcomServerContext;
}

/**
 * Shape assertions against the LIVE Cal.com v2 API.
 *
 * These exist because this package's declared response types drifted from the API and no
 * hand-written fixture could catch it — a fixture encodes the same wrong belief as the type.
 * The suite therefore asserts FIELD NAMES against real payloads, not just `toBeDefined()`.
 *
 * Opt-in: skipped unless a real `CALCOM_API_KEY` is present (root `.env.local`). Note that nx
 * caches test results and no env var is a hash input, so pass `--skip-nx-cache` when toggling
 * the key on or off.
 */
describe.runIf(apiKey)('calcom.api (live)', () => {
  let context: CalcomServerContext;

  beforeAll(() => {
    context = makeLiveCalcomServerContext(apiKey as string);
  });

  describe('getMe()', () => {
    it(
      'should return the authenticated user, with no createdDate field',
      async () => {
        const result = await getMe(context)();

        expect(result.status).toBe('success');
        expect(result.data.id).toBeDefined();
        expect(result.data.email).toBeDefined();
        expect(result.data.name).toBeDefined();

        // the API has no createdDate on /me, despite it once being declared as required
        expect((result.data as unknown as Record<string, unknown>)['createdDate']).toBeUndefined();
        expect(Object.keys(result.data)).toContain('organizationId');
      },
      LIVE_TEST_TIMEOUT_MS
    );
  });

  describe('getSchedules()', () => {
    it(
      'should return overrides as an array and expose ownerId',
      async () => {
        const result = await getSchedules(context)();
        const [schedule] = result.data;

        expect(result.status).toBe('success');
        expect(schedule).toBeDefined();
        expect(schedule.ownerId).toBeDefined();
        expect(Array.isArray(schedule.overrides)).toBe(true);
        expect(Array.isArray(schedule.availability)).toBe(true);
      },
      LIVE_TEST_TIMEOUT_MS
    );
  });

  describe('getEventTypes()', () => {
    it(
      'should expose the wider event type surface',
      async () => {
        const result = await getEventTypes(context)();
        const [eventType] = result.data;

        expect(result.status).toBe('success');
        expect(eventType).toBeDefined();
        expect(eventType.lengthInMinutes).toBeDefined();
        expect(eventType.ownerId).toBeDefined();

        const keys = Object.keys(eventType);
        expect(keys).toContain('skipAttendeeEmailDeliverabilityCheck');
        expect(keys).toContain('hideCalendarEventDetails');
        expect(keys).toContain('confirmationPolicy');
        expect(keys).toContain('bookingWindow');
      },
      LIVE_TEST_TIMEOUT_MS
    );
  });

  describe('getAvailableSlots()', () => {
    it(
      'should return a day-keyed map directly on data, with start on each slot',
      async () => {
        const eventTypes = await getEventTypes(context)();
        const eventTypeId = eventTypes.data[0].id;

        const result = await getAvailableSlots(context)({
          eventTypeId,
          start: '2026-08-12',
          end: '2026-08-15'
        });

        expect(result.status).toBe('success');

        // data IS the day map — there is no `slots` wrapper at cal-api-version 2024-09-04
        expect((result.data as unknown as { slots?: unknown }).slots).toBeUndefined();

        const days = Object.keys(result.data);
        expect(days.length).toBeGreaterThan(0);
        expect(days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        const [slot] = result.data[days[0]];
        expect(slot.start).toBeDefined();
        expect(new Date(slot.start).getTime()).not.toBeNaN();
        expect((slot as unknown as { time?: unknown }).time).toBeUndefined();
      },
      LIVE_TEST_TIMEOUT_MS
    );
  });

  describe('getBooking()', () => {
    it(
      'should return start/end that parse as real dates, not startTime/endTime',
      async () => {
        // the package has no list-bookings wrapper, so read one directly to get a uid
        const bookings = await context.fetchJson<{ readonly data: { readonly uid: string }[] }>('/bookings?take=1', {
          method: 'GET',
          headers: { 'cal-api-version': '2024-08-13' }
        });
        const uid = bookings.data[0]?.uid;

        expect(uid).toBeDefined();

        const result = await getBooking(context)(uid);
        const booking = result.data;

        expect(booking.uid).toBe(uid);
        expect(booking.start).toBeDefined();
        expect(booking.end).toBeDefined();
        expect(new Date(booking.start).getTime()).not.toBeNaN();
        expect(new Date(booking.end).getTime()).not.toBeNaN();

        // the silent bug this replaces: startTime was declared but never returned
        expect((booking as unknown as Record<string, unknown>)['startTime']).toBeUndefined();
        expect(Object.keys(booking)).toContain('meetingUrl');
        expect(Object.keys(booking)).toContain('location');
      },
      LIVE_TEST_TIMEOUT_MS
    );
  });

  describe('error handling', () => {
    it(
      'should surface the code and message nested under the API error envelope',
      async () => {
        const error: Maybe<CalcomServerError> = await getBooking(context)('non-existent-uid-12345').then(
          () => undefined,
          (e) => e as CalcomServerError
        );

        expect(error).toBeDefined();
        // both were silently undefined while the body was read as if it were flat
        expect(error?.error.code).toBeDefined();
        expect(error?.error.message).toBeDefined();
        expect(typeof error?.error.message).toBe('string');
      },
      LIVE_TEST_TIMEOUT_MS
    );
  });

  describe('getCalendars()', () => {
    it(
      'should return an integration OBJECT, a single primary calendar, and a sibling calendars array',
      async () => {
        const result = await getCalendars(context)();
        const [connection] = result.data.connectedCalendars;

        expect(result.status).toBe('success');
        expect(connection).toBeDefined();

        // integration is app metadata, not the "google_calendar" string carried on each calendar
        expect(typeof connection.integration).toBe('object');
        expect(connection.integration.slug).toBeDefined();

        // primary is ONE calendar, and calendars is its sibling — not primary.calendars
        expect(Array.isArray(connection.calendars)).toBe(true);
        expect(connection.calendars.length).toBeGreaterThan(0);
        expect((connection.primary as CalcomCalendar).externalId).toBeDefined();
        expect((connection.primary as unknown as { calendars?: unknown }).calendars).toBeUndefined();

        const [calendar] = connection.calendars;
        expect(calendar.externalId).toBeDefined();
        expect(typeof calendar.integration).toBe('string');
        expect(typeof calendar.isSelected).toBe('boolean');
        expect(calendar.credentialId).toBeDefined();
      },
      LIVE_TEST_TIMEOUT_MS
    );
  });

  describe('getBusyTimes()', () => {
    it(
      'should accept an indexed calendarsToLoad array and a timezone',
      async () => {
        const calendars = await getCalendars(context)();
        const calendarsToLoad = calcomCalendarsToLoadFromConnectedCalendars(calendars.data.connectedCalendars);

        expect(calendarsToLoad.length).toBeGreaterThan(0);

        const result = await getBusyTimes(context)({
          dateFrom: '2026-08-01',
          dateTo: '2026-08-30',
          timeZone: 'America/Chicago',
          calendarsToLoad
        });

        expect(result.status).toBe('success');
        expect(Array.isArray(result.data)).toBe(true);
      },
      LIVE_TEST_TIMEOUT_MS
    );

    it(
      'should accept full ISO instants and loggedInUsersTz',
      async () => {
        const result = await getBusyTimesForConnectedCalendars(context)({
          dateFrom: '2026-08-01T00:00:00.000Z',
          dateTo: '2026-08-30T00:00:00.000Z',
          loggedInUsersTz: 'UTC'
        });

        expect(result.status).toBe('success');
        expect(Array.isArray(result.data)).toBe(true);

        result.data.forEach((busyTime) => {
          expect(busyTime.start).toBeDefined();
          expect(busyTime.end).toBeDefined();
          expect(new Date(busyTime.start).getTime()).not.toBeNaN();
        });
      },
      LIVE_TEST_TIMEOUT_MS
    );
  });
});
