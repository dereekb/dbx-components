import { type Maybe } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomBookingUid } from '../calcom.type';
import { CALCOM_API_VERSION_BOOKINGS, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export type CalcomBookingStatus = 'accepted' | 'pending' | 'cancelled' | 'rejected';

export interface CalcomBookingAttendee {
  readonly name: string;
  readonly email: string;
  readonly timeZone: string;
}

export interface CalcomCreateBookingInput {
  readonly start: string;
  readonly eventTypeId: number;
  readonly attendee: {
    readonly name: string;
    readonly email: string;
    readonly timeZone: string;
  };
  readonly metadata?: Maybe<Record<string, unknown>>;
  readonly lengthInMinutes?: Maybe<number>;
  readonly guests?: Maybe<string[]>;
}

export interface CalcomBooking {
  readonly id: number;
  readonly uid: CalcomBookingUid;
  readonly title: string;
  readonly status: CalcomBookingStatus;
  readonly startTime: string;
  readonly endTime: string;
  readonly attendees: CalcomBookingAttendee[];
  readonly metadata: Record<string, unknown>;
}

export interface CalcomCreateBookingResponse {
  readonly status: string;
  readonly data: CalcomBooking;
}

export interface CalcomGetBookingResponse {
  readonly status: string;
  readonly data: CalcomBooking;
}

export interface CalcomCancelBookingInput {
  readonly uid: CalcomBookingUid;
  readonly cancellationReason?: Maybe<string>;
}

export interface CalcomCancelBookingResponse {
  readonly status: string;
  readonly data: CalcomBooking;
}

export function createBooking(context: CalcomContext): (input: CalcomCreateBookingInput) => Promise<CalcomCreateBookingResponse> {
  return (input) => {
    return context.fetchJson('/bookings', {
      method: 'POST',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_BOOKINGS),
      body: JSON.stringify(input)
    });
  };
}

export function getBooking(context: CalcomContext): (uid: CalcomBookingUid) => Promise<CalcomGetBookingResponse> {
  return (uid) => {
    return context.fetchJson(`/bookings/${uid}`, {
      method: 'GET',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_BOOKINGS)
    });
  };
}

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
