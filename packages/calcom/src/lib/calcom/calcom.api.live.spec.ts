import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { MS_IN_DAY, type Days, type ISO8601DayString, type Maybe, type TimezoneString } from '@dereekb/util';
import { calcomOAuthFactory } from '../oauth/oauth.factory';
import { calcomFactory } from './calcom.factory';
import { type CalcomServerContext } from './calcom.config';
import { getMe } from './calcom.api.user';
import { type CalcomCalendar, calcomCalendarsToLoadFromConnectedCalendars, getBusyTimes, getBusyTimesForConnectedCalendars, getCalendars } from './calcom.api.calendar';
import { type CalcomCreateScheduleInput, type CalcomSchedule, type CalcomScheduleOverride, createSchedule, deleteSchedule, getDefaultSchedule, getSchedule, getSchedules, updateSchedule } from './calcom.api.schedule';
import { getEventTypes } from './calcom.api.eventtype';
import { getAvailableSlots } from './calcom.api.slot';
import { getBooking } from './calcom.api.booking';
import { type CalcomServerError } from '../calcom.error.api';
import { type CalcomScheduleId } from '../calcom.type';

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
 * Relative bounds for the live slots query, in days from now.
 *
 * The window MUST be relative: `/slots` only ever returns bookable FUTURE slots, so a hardcoded
 * window silently rots into the past and the day map comes back empty. It starts tomorrow to
 * clear the event type's minimum booking notice, and runs well out so it straddles a schedule's
 * off days — a narrow window can legitimately return nothing (weekends, an owner who only takes
 * bookings a few days a week) and would flake the assertion.
 */
const SLOT_WINDOW_START_DAYS: Days = 1;
const SLOT_WINDOW_END_DAYS: Days = 30;

/**
 * Timezone for the throwaway schedules the write tests create. Arbitrary — it only has to echo back.
 */
const THROWAWAY_SCHEDULE_TIMEZONE: TimezoneString = 'America/Chicago';

/**
 * The exact field names a schedule override carries on the wire.
 *
 * Asserted as an EXACT key set rather than with `toBeDefined()` on each: the point of this suite is
 * to catch the declared type drifting from the API, and a `toContain` check cannot see a field the
 * API added that {@link CalcomScheduleOverride} does not declare.
 */
const CALCOM_SCHEDULE_OVERRIDE_KEYS = ['date', 'startTime', 'endTime'];

/**
 * A zero-length override range, which is how a full-day "unavailable" is expressed.
 *
 * See {@link CalcomScheduleOverride} — `startTime`/`endTime` are both required, so a day off cannot
 * be sent as a bare date, but `00:00`-`00:00` is accepted and removes the day from availability.
 */
const FULL_DAY_UNAVAILABLE_START = '00:00';
const FULL_DAY_UNAVAILABLE_END = '00:00';

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

  /**
   * Write coverage for the /schedules endpoints, and the source of truth for the override shape.
   *
   * Every test here works on a THROWAWAY schedule it creates itself and deletes afterwards. Nothing
   * in this block touches the account's default schedule: `isDefault` is pinned to false on create
   * and never set to true, because flipping it would silently retarget the real default and every
   * event type bound to it.
   */
  describe('schedule write lifecycle', () => {
    /**
     * Schedules created by the current test, deleted in afterEach even when the test fails.
     */
    let createdScheduleIds: CalcomScheduleId[] = [];

    /**
     * Creates a non-default throwaway schedule and registers it for cleanup.
     *
     * @param input - Overrides applied over the throwaway defaults. `isDefault` is intentionally not
     * overridable here — see the block comment.
     * @returns The created schedule.
     */
    async function createThrowawaySchedule(input: Partial<Omit<CalcomCreateScheduleInput, 'isDefault'>> = {}): Promise<CalcomSchedule> {
      const response = await createSchedule(context)({
        name: `dbx-live-spec-${Date.now()}`,
        timeZone: THROWAWAY_SCHEDULE_TIMEZONE,
        availability: [{ days: ['Monday', 'Friday'], startTime: '08:00', endTime: '12:00' }],
        ...input,
        isDefault: false
      });

      createdScheduleIds.push(response.data.id);
      return response.data;
    }

    afterEach(async () => {
      const ids = createdScheduleIds;
      createdScheduleIds = [];

      // a test that already deleted its schedule leaves a 404 here, which is not a failure
      await Promise.all(ids.map((id) => deleteSchedule(context)(id).catch(() => undefined)));
    });

    it(
      'should echo back a created schedule with overrides carrying exactly date/startTime/endTime',
      async () => {
        const date: ISO8601DayString = '2026-12-24';
        const schedule = await createThrowawaySchedule({ overrides: [{ date, startTime: '10:00', endTime: '11:00' }] });

        expect(schedule.id).toBeDefined();
        expect(schedule.ownerId).toBeDefined();
        expect(schedule.isDefault).toBe(false);
        expect(schedule.timeZone).toBe(THROWAWAY_SCHEDULE_TIMEZONE);

        // the caveat this replaces: the override entry shape was doc-derived and never seen on the wire
        expect(schedule.overrides.length).toBe(1);
        expect(Object.keys(schedule.overrides[0]).sort()).toEqual([...CALCOM_SCHEDULE_OVERRIDE_KEYS].sort());
        expect(schedule.overrides[0].date).toBe(date);
        expect(schedule.overrides[0].startTime).toBe('10:00');
        expect(schedule.overrides[0].endTime).toBe('11:00');
      },
      LIVE_TEST_TIMEOUT_MS
    );

    it(
      'should read a created schedule back by id with the same override shape',
      async () => {
        const created = await createThrowawaySchedule({ overrides: [{ date: '2026-12-24', startTime: '10:00', endTime: '11:00' }] });
        const result = await getSchedule(context)(created.id);

        expect(result.status).toBe('success');
        expect(result.data.id).toBe(created.id);
        expect(Array.isArray(result.data.overrides)).toBe(true);
        expect(Object.keys(result.data.overrides[0]).sort()).toEqual([...CALCOM_SCHEDULE_OVERRIDE_KEYS].sort());
      },
      LIVE_TEST_TIMEOUT_MS
    );

    it(
      'should accept a zero-length override as a full-day unavailable and round-trip it verbatim',
      async () => {
        const date: ISO8601DayString = '2026-12-28';
        const created = await createThrowawaySchedule({
          overrides: [{ date, startTime: FULL_DAY_UNAVAILABLE_START, endTime: FULL_DAY_UNAVAILABLE_END }]
        });

        const result = await getSchedule(context)(created.id);
        const [override] = result.data.overrides;

        // a zero-length range is NOT normalized away or widened — it persists as sent
        expect(override.date).toBe(date);
        expect(override.startTime).toBe(FULL_DAY_UNAVAILABLE_START);
        expect(override.endTime).toBe(FULL_DAY_UNAVAILABLE_END);
      },
      LIVE_TEST_TIMEOUT_MS
    );

    it(
      'should reject an override that omits startTime/endTime',
      async () => {
        // the reason a day off must be sent as 00:00-00:00 rather than as a bare date
        const bareDateOverride = { date: '2026-12-28' } as unknown as CalcomScheduleOverride;

        const error: Maybe<CalcomServerError> = await createThrowawaySchedule({ overrides: [bareDateOverride] }).then(
          () => undefined,
          (e) => e as CalcomServerError
        );

        expect(error).toBeDefined();
        expect(error?.error.code).toBe('BadRequestException');
      },
      LIVE_TEST_TIMEOUT_MS
    );

    it(
      'should apply a PATCH as a partial update, replacing overrides wholesale',
      async () => {
        const created = await createThrowawaySchedule({ overrides: [{ date: '2026-12-24', startTime: '10:00', endTime: '11:00' }] });

        const renamed = await updateSchedule(context)(created.id, { name: `${created.name}-updated` });

        expect(renamed.data.name).toBe(`${created.name}-updated`);
        // untouched fields survive the partial update
        expect(renamed.data.timeZone).toBe(THROWAWAY_SCHEDULE_TIMEZONE);
        expect(renamed.data.availability.length).toBe(created.availability.length);
        expect(renamed.data.overrides.length).toBe(1);

        // overrides are REPLACED, not merged — an empty array clears them
        const cleared = await updateSchedule(context)(created.id, { overrides: [] });
        expect(cleared.data.overrides.length).toBe(0);
      },
      LIVE_TEST_TIMEOUT_MS
    );

    it(
      'should delete a schedule and return a bare status with no data',
      async () => {
        const created = await createThrowawaySchedule();

        const result = await deleteSchedule(context)(created.id);
        createdScheduleIds = createdScheduleIds.filter((id) => id !== created.id);

        expect(result.status).toBe('success');
        // unlike the event-type/webhook deletes, this one echoes nothing back
        expect((result as unknown as Record<string, unknown>)['data']).toBeUndefined();

        const readAfterDelete = await getSchedule(context)(created.id).then(
          () => undefined,
          (e) => e as CalcomServerError
        );
        expect(readAfterDelete).toBeDefined();
      },
      LIVE_TEST_TIMEOUT_MS
    );

    it(
      'should return the account default schedule, which is never the throwaway',
      async () => {
        const created = await createThrowawaySchedule();
        const result = await getDefaultSchedule(context)();

        expect(result.status).toBe('success');
        expect(result.data).toBeDefined();
        expect(result.data?.isDefault).toBe(true);
        // proof the write tests never retargeted the account's default
        expect(result.data?.id).not.toBe(created.id);
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

        const dayStringFromNow = (days: Days): ISO8601DayString => new Date(Date.now() + days * MS_IN_DAY).toISOString().slice(0, 10);

        const result = await getAvailableSlots(context)({
          eventTypeId,
          start: dayStringFromNow(SLOT_WINDOW_START_DAYS),
          end: dayStringFromNow(SLOT_WINDOW_END_DAYS)
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
