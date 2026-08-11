import { type EmailAddress, type ISO8601DateString, type Maybe, type Minutes, type TimezoneString, type WebsiteUrl } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomBookingId, type CalcomBookingUid, type CalcomBookingStatus, type CalcomEventTypeId, type CalcomEventTypeSlug, type CalcomResponseStatus, type CalcomUserId, type CalcomUsername } from '../calcom.type';
import { CALCOM_API_VERSION_BOOKINGS, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomBookingAttendee {
  readonly name: string;
  readonly email: EmailAddress;
  readonly displayEmail: Maybe<EmailAddress>;
  readonly timeZone: TimezoneString;
  readonly language: string;
  readonly absent: boolean;
}

export interface CalcomBookingHost {
  readonly id: CalcomUserId;
  readonly name: string;
  readonly email: EmailAddress;
  readonly displayEmail: Maybe<EmailAddress>;
  readonly username: CalcomUsername;
  readonly timeZone: TimezoneString;
}

/**
 * The event type a booking was made against, as embedded on the booking itself.
 */
export interface CalcomBookingEventType {
  readonly id: CalcomEventTypeId;
  readonly slug: CalcomEventTypeSlug;
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
  /**
   * Only valid when the target event type declares `lengthInMinutesOptions`.
   *
   * Sending it to an event type with a single fixed length is rejected with "Can't specify
   * 'lengthInMinutes' because event type does not have multiple possible lengths", so leave it
   * unset unless the event type is explicitly multi-length.
   */
  readonly lengthInMinutes?: Maybe<Minutes>;
  readonly guests?: Maybe<string[]>;
}

export interface CalcomBooking {
  readonly id: CalcomBookingId;
  readonly uid: CalcomBookingUid;
  readonly title: string;
  readonly description: string;
  readonly status: CalcomBookingStatus;
  /**
   * The start of the booking. Note the API returns `start`/`end`, NOT `startTime`/`endTime`.
   */
  readonly start: ISO8601DateString;
  readonly end: ISO8601DateString;
  readonly duration: Minutes;
  readonly eventTypeId: CalcomEventTypeId;
  readonly eventType: CalcomBookingEventType;
  readonly hosts: CalcomBookingHost[];
  readonly attendees: CalcomBookingAttendee[];
  readonly guests: EmailAddress[];
  /**
   * The join url Cal.com supplies for the meeting, when the location is a conferencing app.
   */
  readonly meetingUrl: Maybe<WebsiteUrl>;
  readonly location: Maybe<string>;
  readonly absentHost: boolean;
  readonly cancellationReason: Maybe<string>;
  readonly cancelledByEmail: Maybe<EmailAddress>;
  readonly rescheduledByEmail: Maybe<EmailAddress>;
  readonly icsUid: string;
  readonly rating: Maybe<number>;
  readonly metadata: Record<string, unknown>;
  readonly bookingFieldsResponses: Record<string, unknown>;
  readonly createdAt: ISO8601DateString;
  readonly updatedAt: ISO8601DateString;
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
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Creates a booking from the given input.
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
 *
 * @__NO_SIDE_EFFECTS__
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
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves a booking by its UID.
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
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Cancels a booking by UID.
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
