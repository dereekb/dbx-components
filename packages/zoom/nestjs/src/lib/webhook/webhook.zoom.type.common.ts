import { ZoomWebhookEventTypeString, ZoomWebhookTimestamp } from '@dereekb/zoom';

/**
 * A parsed RawZoomWebhookEvent that contains the relevant data and the original event.
 */
export interface ZoomWebhookEvent<T, ET extends ZoomWebhookEventTypeString = ZoomWebhookEventTypeString> {
  readonly event: ET;
  readonly event_ts: ZoomWebhookTimestamp;
  readonly payload: T;
}

export type UntypedZoomWebhookEvent = ZoomWebhookEvent<any>;

export interface ZoomWebhookAccountIdAndObjectPayloadData<T = unknown> {
  readonly account_id: string;
  readonly object: T;
}
