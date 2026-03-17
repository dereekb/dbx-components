// MARK: Event Types
export const CALCOM_WEBHOOK_BOOKING_CREATED = 'BOOKING_CREATED';
export const CALCOM_WEBHOOK_BOOKING_CANCELLED = 'BOOKING_CANCELLED';
export const CALCOM_WEBHOOK_BOOKING_RESCHEDULED = 'BOOKING_RESCHEDULED';
export const CALCOM_WEBHOOK_BOOKING_CONFIRMED = 'BOOKING_CONFIRMED';

export type CalcomWebhookEventType = typeof CALCOM_WEBHOOK_BOOKING_CREATED | typeof CALCOM_WEBHOOK_BOOKING_CANCELLED | typeof CALCOM_WEBHOOK_BOOKING_RESCHEDULED | typeof CALCOM_WEBHOOK_BOOKING_CONFIRMED | string;

// MARK: Event
export interface CalcomWebhookEvent<T, ET extends string = string> {
  readonly triggerEvent: ET;
  readonly createdAt: string;
  readonly payload: T;
}

export type UntypedCalcomWebhookEvent = CalcomWebhookEvent<any>;

// MARK: Booking Payload
export interface CalcomWebhookBookingAttendee {
  readonly email: string;
  readonly name: string;
  readonly timeZone: string;
}

export interface CalcomWebhookBookingOrganizer {
  readonly email: string;
  readonly name: string;
  readonly timeZone: string;
}

export interface CalcomWebhookBookingPayload {
  readonly id: number;
  readonly uid: string;
  readonly title: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: string;
  readonly attendees: readonly CalcomWebhookBookingAttendee[];
  readonly organizer: CalcomWebhookBookingOrganizer;
}
