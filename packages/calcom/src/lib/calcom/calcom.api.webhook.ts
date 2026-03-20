import { type WebsiteUrl } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomWebhookId, type CalcomResponseStatus } from '../calcom.type';

export type CalcomWebhookTrigger = 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | 'BOOKING_RESCHEDULED' | 'BOOKING_REQUESTED' | 'BOOKING_REJECTED' | 'BOOKING_NO_SHOW_UPDATED' | 'BOOKING_PAYMENT_INITIATED' | 'BOOKING_PAID' | 'MEETING_STARTED' | 'MEETING_ENDED' | 'RECORDING_READY' | 'RECORDING_TRANSCRIPTION_GENERATED';

export interface CalcomWebhook {
  readonly id: CalcomWebhookId;
  readonly subscriberUrl: WebsiteUrl;
  readonly triggers: CalcomWebhookTrigger[];
  readonly active: boolean;
  readonly payloadTemplate?: string | null;
  readonly secret?: string | null;
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
 * @see https://cal.com/docs/api-reference/v2/webhooks/create-a-webhook
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that creates a webhook subscription from the given input
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
 * @see https://cal.com/docs/api-reference/v2/webhooks/get-all-webhooks
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that retrieves all webhooks
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
 * @see https://cal.com/docs/api-reference/v2/webhooks/get-a-webhook
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that retrieves a specific webhook by ID
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
 * @see https://cal.com/docs/api-reference/v2/webhooks/update-a-webhook
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that updates an existing webhook by ID
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
 * @see https://cal.com/docs/api-reference/v2/webhooks/delete-a-webhook
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that deletes a webhook by ID
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
