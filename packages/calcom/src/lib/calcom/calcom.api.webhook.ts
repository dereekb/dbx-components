import { type WebsiteUrl, type Maybe, type ISO8601DateString } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomWebhookId, type CalcomResponseStatus, type CalcomUserId, type CalcomId, type CalcomEventTypeId } from '../calcom.type';

/**
 * The events a webhook may subscribe to.
 *
 * Enumerated by the API itself: posting an unknown trigger returns the full accepted set.
 */
export type CalcomWebhookTrigger =
  | 'BOOKING_CREATED'
  | 'BOOKING_PAYMENT_INITIATED'
  | 'BOOKING_PAID'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_REQUESTED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_NO_SHOW_UPDATED'
  | 'BOOKING_LOCATION_UPDATED'
  | 'FORM_SUBMITTED'
  | 'FORM_SUBMITTED_NO_EVENT'
  | 'MEETING_STARTED'
  | 'MEETING_ENDED'
  | 'RECORDING_READY'
  | 'RECORDING_TRANSCRIPTION_GENERATED'
  | 'INSTANT_MEETING'
  | 'INSTANT_MEETING_ACCEPTED'
  | 'OOO_CREATED'
  | 'AFTER_HOSTS_CAL_VIDEO_NO_SHOW'
  | 'AFTER_GUESTS_CAL_VIDEO_NO_SHOW'
  | 'ROUTING_FORM_FALLBACK_HIT'
  | 'WRONG_ASSIGNMENT_REPORT'
  | 'CALENDAR_ENTRY_REJECTED'
  | 'DELEGATION_CREDENTIAL_ERROR'
  | 'DELEGATION_CREDENTIAL_ROTATION_REQUIRED'
  | 'DELEGATION_CREDENTIAL_SECRET_ROTATED'
  | 'DELEGATION_CREDENTIAL_SECRET_ROTATION_FAILED';

export interface CalcomWebhook {
  readonly id: CalcomWebhookId;
  readonly subscriberUrl: WebsiteUrl;
  readonly triggers: CalcomWebhookTrigger[];
  readonly active: boolean;
  readonly payloadTemplate: Maybe<string>;
  readonly secret: Maybe<string>;
  readonly userId: Maybe<CalcomUserId>;
  /**
   * The payload version Cal.com sends (e.g. `"2021-10-20"`), distinct from the `cal-api-version`
   * header — which the webhook endpoints do not use at all.
   */
  readonly version: Maybe<string>;
  /**
   * Offset before/after the event for the time-relative triggers, with its unit.
   */
  readonly time: Maybe<number>;
  readonly timeUnit: Maybe<string>;
  /**
   * Returned when reading a webhook, but not on the create response.
   */
  readonly createdAt?: Maybe<ISO8601DateString>;
  readonly teamId?: Maybe<CalcomId>;
  readonly eventTypeId?: Maybe<CalcomEventTypeId>;
  readonly appId?: Maybe<string>;
  readonly platform?: Maybe<boolean>;
  readonly oAuthClientId?: Maybe<string>;
}

export interface CalcomCreateWebhookInput {
  readonly subscriberUrl: WebsiteUrl;
  readonly triggers: CalcomWebhookTrigger[];
  readonly active?: boolean;
  readonly payloadTemplate?: string;
  readonly secret?: string;
}

export interface CalcomUpdateWebhookInput {
  readonly subscriberUrl?: WebsiteUrl;
  readonly triggers?: CalcomWebhookTrigger[];
  readonly active?: boolean;
  readonly payloadTemplate?: string;
  readonly secret?: string;
}

export interface CalcomWebhookResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomWebhook;
}

export interface CalcomGetWebhooksResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomWebhook[];
}

/**
 * Creates a webhook subscription for the authenticated user. Webhooks notify your app
 * when specified events occur (e.g., bookings created, cancelled, rescheduled).
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Creates a webhook subscription from the given input.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/create-a-webhook
 *
 * @example
 * ```ts
 * const response = await createWebhook(context)({
 *   subscriberUrl: 'https://example.com/webhook/calcom',
 *   triggers: ['BOOKING_CREATED', 'BOOKING_CANCELLED'],
 *   active: true
 * });
 * console.log(response.data.id);
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createWebhook(context: CalcomContext): (input: CalcomCreateWebhookInput) => Promise<CalcomWebhookResponse> {
  return (input) =>
    context.fetchJson('/webhooks', {
      method: 'POST',
      body: JSON.stringify(input)
    });
}

/**
 * Retrieves all webhooks for the authenticated user.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves all webhooks.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/get-all-webhooks
 *
 * @example
 * ```ts
 * const response = await getWebhooks(context)();
 * response.data.forEach(wh => console.log(wh.subscriberUrl, wh.triggers));
 * ```
 */
export function getWebhooks(context: CalcomContext): () => Promise<CalcomGetWebhooksResponse> {
  return () =>
    context.fetchJson('/webhooks', {
      method: 'GET'
    });
}

/**
 * Retrieves a specific webhook by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves a specific webhook by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/get-a-webhook
 *
 * @example
 * ```ts
 * const response = await getWebhook(context)(42);
 * console.log(response.data.subscriberUrl);
 * ```
 */
export function getWebhook(context: CalcomContext): (webhookId: CalcomWebhookId) => Promise<CalcomWebhookResponse> {
  return (webhookId) =>
    context.fetchJson(`/webhooks/${webhookId}`, {
      method: 'GET'
    });
}

/**
 * Updates an existing webhook by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Updates an existing webhook by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/update-a-webhook
 *
 * @example
 * ```ts
 * await updateWebhook(context)(42, { active: false });
 * ```
 */
export function updateWebhook(context: CalcomContext): (webhookId: CalcomWebhookId, input: CalcomUpdateWebhookInput) => Promise<CalcomWebhookResponse> {
  return (webhookId, input) =>
    context.fetchJson(`/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
}

/**
 * Deletes a webhook by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Deletes a webhook by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/delete-a-webhook
 *
 * @example
 * ```ts
 * await deleteWebhook(context)(42);
 * ```
 */
export function deleteWebhook(context: CalcomContext): (webhookId: CalcomWebhookId) => Promise<CalcomWebhookResponse> {
  return (webhookId) =>
    context.fetchJson(`/webhooks/${webhookId}`, {
      method: 'DELETE'
    });
}
