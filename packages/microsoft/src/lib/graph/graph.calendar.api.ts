import { type EmailAddress, type ISO8601DateString, type Maybe } from '@dereekb/util';
import { type MicrosoftGraphQuery, type MicrosoftGraphRequestInput, microsoftGraphRequest } from './graph.api';
import { type MicrosoftGraphContext } from './graph.config';
import { type MicrosoftGraphHeaders, microsoftGraphTimeZonePrefer } from './graph.header';
import { type MicrosoftGraphDateTimeTimeZone, type MicrosoftGraphEvent, type MicrosoftGraphEventShowAs, type MicrosoftGraphItemBody, type MicrosoftGraphPage } from './graph.type';

/**
 * The fields `calendar list` and `calendar get` return unless the caller picks others.
 */
export const DEFAULT_MICROSOFT_GRAPH_EVENT_SELECT = 'id,subject,start,end,isAllDay,location,organizer,attendees,webLink';

/**
 * The fields read before deleting or cancelling an event, to tell whether attendees get cancellations.
 */
export const MICROSOFT_GRAPH_EVENT_ORGANIZER_SELECT = 'id,isOrganizer,attendees,isCancelled';

/**
 * Optional `Prefer: outlook.timezone` for the event times Graph returns. Graph answers in UTC without it.
 */
export interface MicrosoftGraphEventTimeZoneInput {
  /**
   * A Windows or IANA time zone name, e.g. `Pacific Standard Time` or `America/Chicago`.
   */
  readonly timeZone?: Maybe<string>;
}

/**
 * Returns the headers an event read or write sends: the `outlook.timezone` Prefer when a time zone is set.
 *
 * @param input - The time zone.
 * @returns The headers, or undefined when none apply.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-list-calendarview#request-headers
 */
export function microsoftGraphEventHeaders(input: MicrosoftGraphEventTimeZoneInput): Maybe<MicrosoftGraphHeaders> {
  return input.timeZone ? { Prefer: microsoftGraphTimeZonePrefer(input.timeZone) } : undefined;
}

/**
 * Returns the path of one of the user's events.
 *
 * @param id - The event id.
 * @returns The path, e.g. `/me/events/AAMk...`.
 */
export function microsoftGraphEventPath(id: string): string {
  return `/me/events/${encodeURIComponent(id)}`;
}

// MARK: Read
export interface MicrosoftGraphListCalendarViewInput extends MicrosoftGraphEventTimeZoneInput {
  readonly start: ISO8601DateString;
  readonly end: ISO8601DateString;
  readonly top?: Maybe<number>;
  /**
   * The fields to return (comma-separated). Defaults to {@link DEFAULT_MICROSOFT_GRAPH_EVENT_SELECT}.
   */
  readonly select?: Maybe<string>;
}

/**
 * A calendarView GET: the path, query and headers, ready for `microsoftGraphRequest` or
 * `microsoftGraphRequestAllPages`.
 */
export interface MicrosoftGraphCalendarViewRequest {
  readonly path: string;
  readonly query: MicrosoftGraphQuery;
  readonly headers: Maybe<MicrosoftGraphHeaders>;
}

/**
 * Builds the calendarView GET between two instants, recurring instances expanded.
 *
 * @param input - The window, page size, fields and time zone.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-list-calendarview
 */
export function microsoftGraphCalendarViewRequest(input: MicrosoftGraphListCalendarViewInput): MicrosoftGraphCalendarViewRequest {
  return { path: '/me/calendarView', query: { startDateTime: input.start, endDateTime: input.end, $top: input.top ?? 50, $orderby: 'start/dateTime', $select: input.select ?? DEFAULT_MICROSOFT_GRAPH_EVENT_SELECT }, headers: microsoftGraphEventHeaders(input) };
}

/**
 * Lists the user's calendar occurrences between two instants (`/me/calendarView`), recurring
 * instances expanded. Requires `Calendars.Read`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that lists calendar events and resolves the first page.
 */
export function listCalendarView(context: MicrosoftGraphContext): (input: MicrosoftGraphListCalendarViewInput) => Promise<MicrosoftGraphPage<MicrosoftGraphEvent>> {
  const request = microsoftGraphRequest(context);
  return (input) => request({ method: 'GET', ...microsoftGraphCalendarViewRequest(input) });
}

export interface MicrosoftGraphGetEventInput extends MicrosoftGraphEventTimeZoneInput {
  readonly id: string;
  /**
   * The fields to return (comma-separated). All fields when absent.
   */
  readonly select?: Maybe<string>;
}

/**
 * Builds the GET of one event.
 *
 * @param input - The event id, fields and time zone.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/event-get
 */
export function microsoftGraphGetEventRequest(input: MicrosoftGraphGetEventInput): MicrosoftGraphRequestInput {
  return { method: 'GET', path: microsoftGraphEventPath(input.id), query: { $select: input.select }, headers: microsoftGraphEventHeaders(input) };
}

/**
 * Reads one event. Requires `Calendars.Read`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that loads the event.
 */
export function getEvent(context: MicrosoftGraphContext): (input: MicrosoftGraphGetEventInput) => Promise<MicrosoftGraphEvent> {
  const request = microsoftGraphRequest(context);
  return (input) => request(microsoftGraphGetEventRequest(input));
}

// MARK: Write
export interface MicrosoftGraphCreateEventInput extends MicrosoftGraphEventTimeZoneInput {
  readonly subject: string;
  readonly start: MicrosoftGraphDateTimeTimeZone;
  readonly end: MicrosoftGraphDateTimeTimeZone;
  /**
   * Required attendees. Each one gets an invitation as soon as the event is created.
   */
  readonly attendees?: Maybe<readonly EmailAddress[]>;
  readonly location?: Maybe<string>;
  readonly body?: Maybe<MicrosoftGraphItemBody>;
  /**
   * Adds a Teams meeting link (`isOnlineMeeting`, `onlineMeetingProvider: teamsForBusiness`).
   */
  readonly onlineMeeting?: Maybe<boolean>;
  readonly showAs?: Maybe<MicrosoftGraphEventShowAs>;
  /**
   * Whether Outlook reminds the user before the event. Graph's default (on) when absent.
   */
  readonly reminder?: Maybe<boolean>;
}

/**
 * Builds the POST that creates an event on the user's default calendar (Graph answers 201 with the event).
 * Every attendee is sent an invitation.
 *
 * @param input - The event fields and the time zone the response's times are in.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/user-post-events
 */
export function microsoftGraphCreateEventRequest(input: MicrosoftGraphCreateEventInput): MicrosoftGraphRequestInput {
  const body: Record<string, unknown> = { subject: input.subject, start: input.start, end: input.end };

  if (input.attendees?.length) {
    body['attendees'] = input.attendees.map((address) => ({ emailAddress: { address }, type: 'required' }));
  }

  if (input.location) {
    body['location'] = { displayName: input.location };
  }

  if (input.body) {
    body['body'] = input.body;
  }

  if (input.onlineMeeting) {
    body['isOnlineMeeting'] = true;
    body['onlineMeetingProvider'] = 'teamsForBusiness';
  }

  if (input.showAs) {
    body['showAs'] = input.showAs;
  }

  if (input.reminder != null) {
    body['isReminderOn'] = input.reminder;
  }

  return { method: 'POST', path: '/me/events', headers: microsoftGraphEventHeaders(input), body };
}

/**
 * Creates an event. Requires `Calendars.ReadWrite`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that creates the event and resolves it.
 */
export function createEvent(context: MicrosoftGraphContext): (input: MicrosoftGraphCreateEventInput) => Promise<MicrosoftGraphEvent> {
  const request = microsoftGraphRequest(context);
  return (input) => request(microsoftGraphCreateEventRequest(input));
}

/**
 * Builds the DELETE of an event (Graph answers 204). On a meeting the user organizes, Outlook sends every
 * attendee a cancellation.
 *
 * @param id - The event id.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/event-delete
 */
export function microsoftGraphDeleteEventRequest(id: string): MicrosoftGraphRequestInput {
  return { method: 'DELETE', path: microsoftGraphEventPath(id) };
}

/**
 * Builds the POST that cancels a meeting the user organizes, sending attendees the comment with the
 * cancellation (Graph answers 202). Only the organizer can cancel.
 *
 * @param input - The event id and the comment.
 * @param input.id - The event id.
 * @param input.comment - The text sent to attendees with the cancellation.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/event-cancel
 */
export function microsoftGraphCancelEventRequest(input: { readonly id: string; readonly comment?: Maybe<string> }): MicrosoftGraphRequestInput {
  return { method: 'POST', path: `${microsoftGraphEventPath(input.id)}/cancel`, body: input.comment ? { comment: input.comment } : {} };
}

/**
 * Returns how many attendees get a cancellation when the user deletes or cancels the event: its attendee
 * count when the user organizes it, else 0 (deleting an invitation only removes it from the user's calendar).
 *
 * @param event - The event, read with at least `isOrganizer` and `attendees`.
 * @returns The number of attendees Outlook notifies.
 */
export function microsoftGraphEventCancellationRecipientCount(event: Pick<MicrosoftGraphEvent, 'isOrganizer' | 'attendees'>): number {
  return event.isOrganizer ? (event.attendees?.length ?? 0) : 0;
}
