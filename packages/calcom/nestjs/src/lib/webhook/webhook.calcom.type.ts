import { type EmailAddress, type ISO8601DateString, type TimezoneString } from '@dereekb/util';
import { type CalcomBookingId, type CalcomBookingUid, type CalcomBookingStatus } from '@dereekb/calcom';

// MARK: Event Types
export const CALCOM_WEBHOOK_BOOKING_CREATED = 'BOOKING_CREATED';
export const CALCOM_WEBHOOK_BOOKING_CANCELLED = 'BOOKING_CANCELLED';
export const CALCOM_WEBHOOK_BOOKING_RESCHEDULED = 'BOOKING_RESCHEDULED';
export const CALCOM_WEBHOOK_BOOKING_CONFIRMED = 'BOOKING_CONFIRMED';

export type CalcomWebhookEventType = typeof CALCOM_WEBHOOK_BOOKING_CREATED | typeof CALCOM_WEBHOOK_BOOKING_CANCELLED | typeof CALCOM_WEBHOOK_BOOKING_RESCHEDULED | typeof CALCOM_WEBHOOK_BOOKING_CONFIRMED | string;

// MARK: Event
export interface CalcomWebhookEvent<T, ET extends string = string> {
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
