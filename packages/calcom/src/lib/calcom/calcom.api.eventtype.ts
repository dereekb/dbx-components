import { type Minutes } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomEventTypeId, type CalcomEventTypeSlug, type CalcomResponseStatus } from '../calcom.type';
import { CALCOM_API_VERSION_EVENT_TYPES, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomEventType {
  readonly id: CalcomEventTypeId;
  readonly title: string;
  readonly slug: CalcomEventTypeSlug;
  readonly description: string | null;
  readonly lengthInMinutes: Minutes;
  readonly locations: unknown[];
}

export interface CalcomGetEventTypesResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomEventType[];
}

export interface CalcomEventTypeResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomEventType;
}

export interface CalcomCreateEventTypeInput {
  readonly title: string;
  readonly slug: CalcomEventTypeSlug;
  readonly lengthInMinutes: Minutes;
  readonly description?: string;
  readonly locations?: unknown[];
  readonly bookingFields?: unknown[];
}

export interface CalcomUpdateEventTypeInput {
  readonly title?: string;
  readonly slug?: CalcomEventTypeSlug;
  readonly lengthInMinutes?: Minutes;
  readonly description?: string;
  readonly locations?: unknown[];
  readonly bookingFields?: unknown[];
}

/**
 * Retrieves all event types for the authenticated user.
 *
 * @see https://cal.com/docs/api-reference/v2/event-types/get-all-event-types
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that retrieves all event types
 *
 * @example
 * ```ts
 * const response = await getEventTypes(context)();
 * response.data.forEach(et => console.log(et.title, et.slug, et.lengthInMinutes));
 * ```
 */
export function getEventTypes(context: CalcomContext): () => Promise<CalcomGetEventTypesResponse> {
  return () => context.fetchJson('/event-types', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES) });
}

/**
 * Creates a new event type for the authenticated user.
 *
 * @see https://cal.com/docs/api-reference/v2/event-types/create-an-event-type
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that creates a new event type from the given input
 *
 * @example
 * ```ts
 * const response = await createEventType(context)({
 *   title: 'Mentoring Session',
 *   slug: 'mentoring-session',
 *   lengthInMinutes: 30
 * });
 * console.log(response.data.id);
 * ```
 */
export function createEventType(context: CalcomContext): (input: CalcomCreateEventTypeInput) => Promise<CalcomEventTypeResponse> {
  return (input) =>
    context.fetchJson('/event-types', {
      method: 'POST',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES),
      body: JSON.stringify(input)
    });
}

/**
 * Updates an existing event type by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/event-types/update-an-event-type
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that updates an event type by ID
 *
 * @example
 * ```ts
 * await updateEventType(context)(12345, { title: 'Updated Session Title' });
 * ```
 */
export function updateEventType(context: CalcomContext): (eventTypeId: CalcomEventTypeId, input: CalcomUpdateEventTypeInput) => Promise<CalcomEventTypeResponse> {
  return (eventTypeId, input) =>
    context.fetchJson(`/event-types/${eventTypeId}`, {
      method: 'PATCH',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES),
      body: JSON.stringify(input)
    });
}

/**
 * Deletes an event type by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/event-types/delete-an-event-type
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that deletes an event type by ID
 *
 * @example
 * ```ts
 * await deleteEventType(context)(12345);
 * ```
 */
export function deleteEventType(context: CalcomContext): (eventTypeId: CalcomEventTypeId) => Promise<CalcomEventTypeResponse> {
  return (eventTypeId) =>
    context.fetchJson(`/event-types/${eventTypeId}`, {
      method: 'DELETE',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES)
    });
}
