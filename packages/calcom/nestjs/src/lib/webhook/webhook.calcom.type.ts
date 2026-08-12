import { type EmailAddress, type ISO8601DateString, type SuggestedString, type TimezoneString } from '@dereekb/util';
import { type CalcomBookingId, type CalcomBookingUid, type CalcomBookingStatus, type CalcomWebhookTrigger } from '@dereekb/calcom';

// MARK: Event Types
export const CALCOM_WEBHOOK_BOOKING_CREATED = 'BOOKING_CREATED';
export const CALCOM_WEBHOOK_BOOKING_CANCELLED = 'BOOKING_CANCELLED';
export const CALCOM_WEBHOOK_BOOKING_RESCHEDULED = 'BOOKING_RESCHEDULED';

/**
 * The `triggerEvent` of an inbound webhook payload.
 *
 * Deliberately open-ended: this is a value Cal.com sends US, so a trigger added upstream — or one
 * enabled on a subscription that predates this package — has to keep parsing rather than fail to
 * type. {@link CalcomWebhookTrigger} is the set the API actually accepts on a subscription, and is
 * what autocompletes here.
 *
 * Note there is no `BOOKING_CONFIRMED` trigger, despite this package once declaring one: a booking
 * awaiting confirmation arrives as `BOOKING_REQUESTED` and its acceptance as `BOOKING_CREATED`.
 */
export type CalcomWebhookEventType = SuggestedString<CalcomWebhookTrigger>;

// MARK: Event
export interface CalcomWebhookEvent<T, ET extends CalcomWebhookEventType = CalcomWebhookEventType> {
  readonly triggerEvent: ET;
  readonly createdAt: ISO8601DateString;
  readonly payload: T;
}

export type UntypedCalcomWebhookEvent = CalcomWebhookEvent<any>;

// MARK: Booking Payload
export interface CalcomWebhookBookingAttendee {
  readonly email: EmailAddress;
  readonly name: string;
  readonly timeZone: TimezoneString;
}

export interface CalcomWebhookBookingOrganizer {
  readonly email: EmailAddress;
  readonly name: string;
  readonly timeZone: TimezoneString;
}

/**
 * The booking as Cal.com POSTs it to a webhook subscriber.
 *
 * Deliberately NOT the same shape as the REST {@link CalcomBooking}: the webhook payload mirrors
 * Cal.com's internal booking model and uses `startTime`/`endTime`, while `GET /v2/bookings/{uid}`
 * returns `start`/`end`. Do not "align" these two out of a belief that they drifted — they are
 * different surfaces.
 *
 * NOTE: unlike the REST types in this package, this shape has not been verified against a live
 * payload (that requires a publicly reachable subscriber). Treat it as unconfirmed.
 */
export interface CalcomWebhookBookingPayload {
  readonly id: CalcomBookingId;
  readonly uid: CalcomBookingUid;
  readonly title: string;
  readonly startTime: ISO8601DateString;
  readonly endTime: ISO8601DateString;
  readonly status: CalcomBookingStatus;
  readonly attendees: readonly CalcomWebhookBookingAttendee[];
  readonly organizer: CalcomWebhookBookingOrganizer;
}
