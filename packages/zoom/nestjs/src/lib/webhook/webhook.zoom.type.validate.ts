import { ZoomWebhookEvent } from './webhook.zoom.type.common';

export const ZOOM_WEBHOOK_URL_VALIDATION_EVENT_TYPE = 'endpoint.url_validation';

export type ZoomWebhookUrlValidationEventType = typeof ZOOM_WEBHOOK_URL_VALIDATION_EVENT_TYPE;

export type ZoomWebhookUrlValidationPlainTokenString = string;

export type ZoomWebhookUrlValidationEncryptedTokenString = string;

export interface ZoomWebhookUrlValidationPayload {
  readonly plainToken: ZoomWebhookUrlValidationPlainTokenString;
}

export type ZoomWebhookUrlValidationEvent = ZoomWebhookEvent<ZoomWebhookUrlValidationPayload, ZoomWebhookUrlValidationEventType>;
