import { type CalcomContext } from './calcom.config';
import { type CalcomEventTypeId } from '../calcom.type';
import { CALCOM_API_VERSION_EVENT_TYPES, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomEventType {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly lengthInMinutes: number;
  readonly locations: unknown[];
}

export interface CalcomGetEventTypesResponse {
  readonly status: string;
  readonly data: CalcomEventType[];
}

export interface CalcomEventTypeResponse {
  readonly status: string;
  readonly data: CalcomEventType;
}

export interface CalcomCreateEventTypeInput {
  readonly title: string;
  readonly slug: string;
  readonly lengthInMinutes: number;
  readonly description?: string;
  readonly locations?: unknown[];
  readonly bookingFields?: unknown[];
}

export interface CalcomUpdateEventTypeInput {
  readonly title?: string;
  readonly slug?: string;
  readonly lengthInMinutes?: number;
  readonly description?: string;
  readonly locations?: unknown[];
  readonly bookingFields?: unknown[];
}

export function getEventTypes(context: CalcomContext): () => Promise<CalcomGetEventTypesResponse> {
  return () => context.fetchJson('/event-types', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES) });
}

export function createEventType(context: CalcomContext): (input: CalcomCreateEventTypeInput) => Promise<CalcomEventTypeResponse> {
  return (input) =>
    context.fetchJson('/event-types', {
      method: 'POST',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES),
      body: JSON.stringify(input)
    });
}

export function updateEventType(context: CalcomContext): (eventTypeId: CalcomEventTypeId, input: CalcomUpdateEventTypeInput) => Promise<CalcomEventTypeResponse> {
  return (eventTypeId, input) =>
    context.fetchJson(`/event-types/${eventTypeId}`, {
      method: 'PATCH',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES),
      body: JSON.stringify(input)
    });
}

export function deleteEventType(context: CalcomContext): (eventTypeId: CalcomEventTypeId) => Promise<CalcomEventTypeResponse> {
  return (eventTypeId) =>
    context.fetchJson(`/event-types/${eventTypeId}`, {
      method: 'DELETE',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES)
    });
}
