import { ZoomWebhookTimestamp } from '@dereekb/zoom';


export type ZoomWebhookEventType;

/**
 * A parsed RawZoomWebhookEvent that contains the relevant data and the original event.
 */
export interface ZoomWebhookEvent<T> {
  readonly event: ZoomWebhookEventType;
  readonly event_ts: ZoomWebhookTimestamp;
  readonly payload: T;
}

export type RawZoomWebhookEvent = ZoomWebhookEvent<any>;
