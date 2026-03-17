import { type ISO8601DateString, type Maybe, type Minutes, type TimezoneString } from '@dereekb/util';
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
  readonly time: ISO8601DateString;
}

export interface CalcomGetAvailableSlotsResponse {
  readonly status: CalcomResponseStatus;
  readonly data: {
    readonly slots: Record<string, CalcomSlot[]>;
  };
}

/**
 * Queries available booking slots for a given event type within a date range.
 * This endpoint is public and does not require authentication.
 *
 * Identify the event type by `eventTypeId`, or by `eventTypeSlug` + `username`/`teamSlug`.
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
 * for (const [date, slots] of Object.entries(response.data.slots)) {
 *   console.log(date, slots.map(s => s.time));
 * }
 * ```
 */
export function getAvailableSlots(context: CalcomContext | CalcomPublicContext): (input: CalcomGetAvailableSlotsInput) => Promise<CalcomGetAvailableSlotsResponse> {
  return (input) => {
    const params = makeUrlSearchParams(input);
    return context.fetchJson(`/slots?${params}`, { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SLOTS) });
  };
}
