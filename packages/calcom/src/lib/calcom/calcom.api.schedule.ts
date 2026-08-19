import { type ISO8601DayString, type Maybe, type TimezoneString } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomScheduleId, type CalcomResponseStatus, type CalcomUserId } from '../calcom.type';
import { CALCOM_API_VERSION_SCHEDULES, calcomApiVersionHeaders } from '../shared/calcom.api-version';

/**
 * A time of day within a schedule, as the `HH:MM` (24-hour, zero-padded) string Cal.com uses.
 *
 * The format is enforced server-side: a value that does not match is rejected with a 400 whose
 * detail reads "startTime must be a valid time format HH:MM". Seconds are not accepted.
 */
export type CalcomTimeOfDayString = string;

export interface CalcomAvailabilityRule {
  readonly days: string[];
  readonly startTime: CalcomTimeOfDayString;
  readonly endTime: CalcomTimeOfDayString;
}

/**
 * A date-specific exception to a schedule's weekly availability.
 *
 * An override REPLACES the weekly rules for its date rather than adding to them — verified live by
 * overriding a Monday whose weekly rule was 08:00-12:00 with 13:00-14:00 and observing `/slots`
 * return only the 13:00-14:00 slots for that day.
 *
 * A full-day "unavailable" IS expressible here: `startTime` and `endTime` are both REQUIRED (see
 * {@link CalcomTimeOfDayString} — omitting either is a 400), but a ZERO-LENGTH range of
 * `00:00`-`00:00` is accepted, round-trips verbatim, and removes the day from availability
 * entirely. Verified live by putting a zero-length override on one Monday while leaving a second
 * Monday untouched, then reading a single `/slots` window covering both: the overridden day came
 * back with no slots at all (absent from the day map) while the control Monday kept its 8. So a
 * caller representing a day off as an empty range list maps it to `00:00`-`00:00` here, and does
 * NOT need the separate `/v2/ooo` (out-of-office) endpoints for it.
 */
export interface CalcomScheduleOverride {
  readonly date: ISO8601DayString;
  readonly startTime: CalcomTimeOfDayString;
  readonly endTime: CalcomTimeOfDayString;
}

export interface CalcomSchedule {
  readonly id: CalcomScheduleId;
  readonly ownerId: CalcomUserId;
  readonly name: string;
  readonly timeZone: TimezoneString;
  readonly availability: CalcomAvailabilityRule[];
  readonly isDefault: boolean;
  /**
   * Date-specific overrides, returned as an ARRAY (not a date-keyed record).
   */
  readonly overrides: CalcomScheduleOverride[];
}

export interface CalcomGetSchedulesResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomSchedule[];
}

/**
 * A response carrying a single schedule.
 *
 * Returned by create/read/update — each echoes the full schedule back, including the availability
 * rules and overrides as they were persisted.
 */
export interface CalcomScheduleResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomSchedule;
}

/**
 * The response to a default-schedule lookup.
 *
 * Distinct from {@link CalcomScheduleResponse} because `data` is optional: an account with a
 * default schedule was observed returning the full schedule object, but an account that has
 * deleted every schedule was deliberately not exercised (doing so would have meant destroying the
 * verifying account's only schedule), so the absent case is typed rather than assumed away.
 */
export interface CalcomDefaultScheduleResponse {
  readonly status: CalcomResponseStatus;
  readonly data: Maybe<CalcomSchedule>;
}

/**
 * The response to a schedule deletion.
 *
 * Carries NO `data` — unlike the event-type and webhook deletes, which echo the deleted record,
 * this endpoint returns a bare `{ "status": "success" }`.
 */
export interface CalcomDeleteScheduleResponse {
  readonly status: CalcomResponseStatus;
}

/**
 * The schedule fields accepted by both create and update.
 */
export interface CalcomScheduleInputSettings {
  /**
   * The weekly availability rules. Omitting this on create yields a schedule with no availability.
   */
  readonly availability?: Maybe<CalcomAvailabilityRule[]>;
  /**
   * The date-specific exceptions. See {@link CalcomScheduleOverride} for expressing a full day off.
   */
  readonly overrides?: Maybe<CalcomScheduleOverride[]>;
}

export interface CalcomCreateScheduleInput extends CalcomScheduleInputSettings {
  readonly name: string;
  readonly timeZone: TimezoneString;
  readonly isDefault: boolean;
}

/**
 * A PARTIAL update — every field is optional and only the provided ones are changed.
 *
 * Note that `availability` and `overrides` are REPLACED wholesale when provided, not merged, so
 * passing `overrides: []` clears every existing override.
 */
export interface CalcomUpdateScheduleInput extends CalcomScheduleInputSettings {
  readonly name?: Maybe<string>;
  readonly timeZone?: Maybe<TimezoneString>;
  readonly isDefault?: Maybe<boolean>;
}

/**
 * Retrieves all schedules for the authenticated user, including availability rules and overrides.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves all schedules.
 *
 * @see https://cal.com/docs/api-reference/v2/schedules/get-all-schedules
 *
 * @example
 * ```ts
 * const response = await getSchedules(context)();
 * response.data.forEach(schedule => console.log(schedule.name, schedule.timeZone));
 * ```
 */
export function getSchedules(context: CalcomContext): () => Promise<CalcomGetSchedulesResponse> {
  return () => context.fetchJson('/schedules', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SCHEDULES) });
}

/**
 * Creates a new schedule for the authenticated user.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Creates a new schedule from the given input.
 *
 * @see https://cal.com/docs/api-reference/v2/schedules/create-a-schedule
 *
 * @example
 * ```ts
 * const response = await createSchedule(context)({
 *   name: 'Coaching Hours',
 *   timeZone: 'America/Chicago',
 *   isDefault: false,
 *   availability: [{ days: ['Monday', 'Friday'], startTime: '08:00', endTime: '12:00' }],
 *   overrides: [{ date: '2026-12-24', startTime: '10:00', endTime: '11:00' }]
 * });
 * console.log(response.data.id);
 * ```
 */
export function createSchedule(context: CalcomContext): (input: CalcomCreateScheduleInput) => Promise<CalcomScheduleResponse> {
  return (input) =>
    context.fetchJson('/schedules', {
      method: 'POST',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SCHEDULES),
      body: JSON.stringify(input)
    });
}

/**
 * Retrieves the authenticated user's default schedule.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves the default schedule.
 *
 * @see https://cal.com/docs/api-reference/v2/schedules/get-default-schedule
 *
 * @example
 * ```ts
 * const response = await getDefaultSchedule(context)();
 * console.log(response.data?.name, response.data?.timeZone);
 * ```
 */
export function getDefaultSchedule(context: CalcomContext): () => Promise<CalcomDefaultScheduleResponse> {
  return () => context.fetchJson('/schedules/default', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SCHEDULES) });
}

/**
 * Retrieves a single schedule by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves a schedule by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/schedules/get-a-schedule
 *
 * @example
 * ```ts
 * const response = await getSchedule(context)(588440);
 * console.log(response.data.availability, response.data.overrides);
 * ```
 */
export function getSchedule(context: CalcomContext): (scheduleId: CalcomScheduleId) => Promise<CalcomScheduleResponse> {
  return (scheduleId) =>
    context.fetchJson(`/schedules/${scheduleId}`, {
      method: 'GET',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SCHEDULES)
    });
}

/**
 * Updates an existing schedule by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Updates a schedule by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/schedules/update-a-schedule
 *
 * @example
 * ```ts
 * // replaces the weekly rules and marks the whole of Christmas Day unavailable
 * await updateSchedule(context)(588440, {
 *   availability: [{ days: ['Monday'], startTime: '09:00', endTime: '17:00' }],
 *   overrides: [{ date: '2026-12-25', startTime: '00:00', endTime: '00:00' }]
 * });
 * ```
 */
export function updateSchedule(context: CalcomContext): (scheduleId: CalcomScheduleId, input: CalcomUpdateScheduleInput) => Promise<CalcomScheduleResponse> {
  return (scheduleId, input) =>
    context.fetchJson(`/schedules/${scheduleId}`, {
      method: 'PATCH',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SCHEDULES),
      body: JSON.stringify(input)
    });
}

/**
 * Deletes a schedule by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Deletes a schedule by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/schedules/delete-a-schedule
 *
 * @example
 * ```ts
 * await deleteSchedule(context)(588440);
 * ```
 */
export function deleteSchedule(context: CalcomContext): (scheduleId: CalcomScheduleId) => Promise<CalcomDeleteScheduleResponse> {
  return (scheduleId) =>
    context.fetchJson(`/schedules/${scheduleId}`, {
      method: 'DELETE',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SCHEDULES)
    });
}
