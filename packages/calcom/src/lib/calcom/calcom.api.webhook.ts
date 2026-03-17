import { type CalcomContext } from './calcom.config';

export type CalcomWebhookTrigger = 'BOOKING_CREATED' | 'BOOKING_CANCELLED' | 'BOOKING_RESCHEDULED' | 'BOOKING_REQUESTED' | 'BOOKING_REJECTED' | 'BOOKING_NO_SHOW_UPDATED' | 'BOOKING_PAYMENT_INITIATED' | 'BOOKING_PAID' | 'MEETING_STARTED' | 'MEETING_ENDED' | 'RECORDING_READY' | 'RECORDING_TRANSCRIPTION_GENERATED';

export interface CalcomWebhook {
  readonly id: number;
  readonly subscriberUrl: string;
  readonly triggers: CalcomWebhookTrigger[];
  readonly active: boolean;
  readonly payloadTemplate?: string | null;
  readonly secret?: string | null;
}

export interface CalcomCreateWebhookInput {
  readonly subscriberUrl: string;
  readonly triggers: CalcomWebhookTrigger[];
  readonly active?: boolean;
  readonly payloadTemplate?: string;
  readonly secret?: string;
}

export interface CalcomUpdateWebhookInput {
  readonly subscriberUrl?: string;
  readonly triggers?: CalcomWebhookTrigger[];
  readonly active?: boolean;
  readonly payloadTemplate?: string;
  readonly secret?: string;
}

export interface CalcomWebhookResponse {
  readonly status: string;
  readonly data: CalcomWebhook;
}

export interface CalcomGetWebhooksResponse {
  readonly status: string;
  readonly data: CalcomWebhook[];
}

export function createWebhook(context: CalcomContext): (input: CalcomCreateWebhookInput) => Promise<CalcomWebhookResponse> {
  return (input) =>
    context.fetchJson('/webhooks', {
      method: 'POST',
      body: JSON.stringify(input)
    });
}

export function getWebhooks(context: CalcomContext): () => Promise<CalcomGetWebhooksResponse> {
  return () =>
    context.fetchJson('/webhooks', {
      method: 'GET'
    });
}

export function getWebhook(context: CalcomContext): (webhookId: number) => Promise<CalcomWebhookResponse> {
  return (webhookId) =>
    context.fetchJson(`/webhooks/${webhookId}`, {
      method: 'GET'
    });
}

export function updateWebhook(context: CalcomContext): (webhookId: number, input: CalcomUpdateWebhookInput) => Promise<CalcomWebhookResponse> {
  return (webhookId, input) =>
    context.fetchJson(`/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
}

export function deleteWebhook(context: CalcomContext): (webhookId: number) => Promise<CalcomWebhookResponse> {
  return (webhookId) =>
    context.fetchJson(`/webhooks/${webhookId}`, {
      method: 'DELETE'
    });
}
