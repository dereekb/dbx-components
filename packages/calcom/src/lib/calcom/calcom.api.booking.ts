import { type EmailAddress, type ISO8601DateString, type Maybe, type Minutes, type TimezoneString } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomBookingId, type CalcomBookingUid, type CalcomBookingStatus, type CalcomEventTypeId, type CalcomResponseStatus } from '../calcom.type';
import { CALCOM_API_VERSION_BOOKINGS, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomBookingAttendee {
  readonly name: string;
  readonly email: EmailAddress;
  readonly timeZone: TimezoneString;
}

export interface CalcomCreateBookingInput {
  readonly start: ISO8601DateString;
  readonly eventTypeId: CalcomEventTypeId;
  readonly attendee: {
    readonly name: string;
    readonly email: EmailAddress;
    readonly timeZone: TimezoneString;
  };
  readonly metadata?: Maybe<Record<string, unknown>>;
  readonly lengthInMinutes?: Maybe<Minutes>;
  readonly guests?: Maybe<string[]>;
}

export interface CalcomBooking {
  readonly id: CalcomBookingId;
  readonly uid: CalcomBookingUid;
  readonly title: string;
  readonly status: CalcomBookingStatus;
  readonly startTime: ISO8601DateString;
  readonly endTime: ISO8601DateString;
  readonly attendees: CalcomBookingAttendee[];
  readonly metadata: Record<string, unknown>;
}

export interface CalcomCreateBookingResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomBooking;
}

export interface CalcomGetBookingResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomBooking;
}

export interface CalcomCancelBookingInput {
  readonly uid: CalcomBookingUid;
  readonly cancellationReason?: Maybe<string>;
}

export interface CalcomCancelBookingResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomBooking;
}

/**
 * Creates a new booking for the specified event type. The `attendee` represents the person
 * booking (the client), not the host. This endpoint can be called without authentication.
 *
 * @see https://cal.com/docs/api-reference/v2/bookings/create-a-booking
 *
 * @example
 * ```ts
 * const response = await createBooking(context)({
 *   start: '2026-03-20T14:00:00.000Z',
 *   eventTypeId: 12345,
 *   attendee: { name: 'Jane Doe', email: 'jane@example.com', timeZone: 'America/New_York' }
 * });
 * console.log(response.data.uid);
 * ```
 */
export function createBooking(context: CalcomContext): (input: CalcomCreateBookingInput) => Promise<CalcomCreateBookingResponse> {
  return (input) => {
    return context.fetchJson('/bookings', {
      method: 'POST',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_BOOKINGS),
      body: JSON.stringify(input)
    });
  };
}

/**
 * Retrieves a booking by its unique UID.
 *
 * @see https://cal.com/docs/api-reference/v2/bookings/get-a-booking
 *
 * @example
 * ```ts
 * const response = await getBooking(context)('abc-123-uid');
 * console.log(response.data.title, response.data.status);
 * ```
 */
export function getBooking(context: CalcomContext): (uid: CalcomBookingUid) => Promise<CalcomGetBookingResponse> {
  return (uid) => {
    return context.fetchJson(`/bookings/${uid}`, {
      method: 'GET',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_BOOKINGS)
    });
  };
}

/**
 * Cancels a booking by its unique UID, with an optional cancellation reason.
 *
 * @see https://cal.com/docs/api-reference/v2/bookings/cancel-a-booking
 *
 * @example
 * ```ts
 * await cancelBooking(context)({ uid: 'abc-123-uid', cancellationReason: 'Schedule conflict' });
 * ```
 */
export function cancelBooking(context: CalcomContext): (input: CalcomCancelBookingInput) => Promise<CalcomCancelBookingResponse> {
  return (input) => {
    const body: Record<string, unknown> = {};

    if (input.cancellationReason) {
      body['cancellationReason'] = input.cancellationReason;
    }

    return context.fetchJson(`/bookings/${input.uid}/cancel`, {
      method: 'POST',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_BOOKINGS),
      body: JSON.stringify(body)
    });
  };
}
