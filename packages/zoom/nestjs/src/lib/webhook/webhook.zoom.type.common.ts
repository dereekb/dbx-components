import { type EmailAddress } from '@dereekb/util';
import { type ZoomAccountId, type ZoomUserId, type ZoomWebhookEventTypeString, type ZoomWebhookTimestamp } from '@dereekb/zoom';

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
  readonly account_id: ZoomAccountId;
  readonly object: T;
}

export interface ZoomWebhookOperatorAndObjectPayloadData<T = unknown> extends ZoomWebhookAccountIdAndObjectPayloadData<T> {
  /**
   * User id of the person who performed the action.
   */
  readonly operator_id: ZoomUserId;
  /**
   * Email address of the person who performed the action.
   */
  readonly operator: EmailAddress;
}

/**
 * "The type of operation performed.
 * all - The change was applied to all meetings.
 * single - The change was applied only to a single meeting.
 */
export type ZoomWebhookOperationType = 'all' | 'single';

export interface ZoomWebhookOperationAndObjectPayloadData<T = unknown> extends ZoomWebhookOperatorAndObjectPayloadData<T> {
  /**
   * The type of operation performed.
   */
  readonly operation: ZoomWebhookOperationType;
}

export interface ZoomWebhookTimestampRef {
  readonly time_stamp: ZoomWebhookTimestamp;
}

export interface ZoomWebhookOldObjectRef<T = unknown> {
  readonly old_object: T;
}
