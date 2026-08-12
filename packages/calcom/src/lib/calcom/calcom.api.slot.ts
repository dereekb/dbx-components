import { type ISO8601DateString, type ISO8601DayString, type Maybe, type Minutes, type TimezoneString } from '@dereekb/util';
import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type CalcomContext, type CalcomPublicContext } from './calcom.config';
import { type CalcomEventTypeId, type CalcomEventTypeSlug, type CalcomUsername, type CalcomTeamSlug, type CalcomOrganizationSlug, type CalcomResponseStatus } from '../calcom.type';
import { CALCOM_API_VERSION_SLOTS, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomGetAvailableSlotsInput {
  readonly start: ISO8601DateString;
  readonly end: ISO8601DateString;
  readonly eventTypeId?: Maybe<CalcomEventTypeId>;
  readonly eventTypeSlug?: Maybe<CalcomEventTypeSlug>;
  readonly username?: Maybe<CalcomUsername>;
  readonly teamSlug?: Maybe<CalcomTeamSlug>;
  readonly organizationSlug?: Maybe<CalcomOrganizationSlug>;
  readonly timeZone?: Maybe<TimezoneString>;
  readonly duration?: Maybe<Minutes>;
  readonly format?: Maybe<'range' | 'time'>;
}

export interface CalcomSlot {
  readonly start: ISO8601DateString;
  /**
   * The end of the slot. Only returned when `format: 'range'` was requested.
   */
  readonly end?: Maybe<ISO8601DateString>;
}

/**
 * Available slots keyed by day (`"2026-08-12"`), each holding that day's slots.
 */
export type CalcomSlotsByDay = Record<ISO8601DayString, CalcomSlot[]>;

export interface CalcomGetAvailableSlotsResponse {
  readonly status: CalcomResponseStatus;
  /**
   * The day-keyed slot map itself — at `cal-api-version: 2024-09-04` there is no `slots` wrapper.
   */
  readonly data: CalcomSlotsByDay;
}

/**
 * Queries available booking slots for a given event type within a date range.
 * This endpoint is public and does not require authentication.
 *
 * Identify the event type by `eventTypeId`, or by `eventTypeSlug` + `username`/`teamSlug`.
 *
 * @param context - The Cal.com API context (authenticated or public)
 * @returns Queries available slots for the given input.
 *
 * The `cal-api-version` header is REQUIRED here — without it the endpoint 404s.
 *
 * @see https://cal.com/docs/api-reference/v2/slots/get-available-time-slots-for-an-event-type
 *
 * @example
 * ```ts
 * const response = await getAvailableSlots(context)({
 *   start: '2026-03-17T00:00:00.000Z',
 *   end: '2026-03-24T00:00:00.000Z',
 *   eventTypeId: 12345
 * });
 *
 * for (const [date, slots] of Object.entries(response.data)) {
 *   console.log(date, slots.map(s => s.start));
 * }
 * ```
 */
export function getAvailableSlots(context: CalcomContext | CalcomPublicContext): (input: CalcomGetAvailableSlotsInput) => Promise<CalcomGetAvailableSlotsResponse> {
  return (input) => {
    const params = makeUrlSearchParams(input);
    return context.fetchJson(`/slots?${params}`, { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SLOTS) });
  };
}
