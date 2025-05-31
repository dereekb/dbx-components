export interface ZoomObjectWithAccountId<T = unknown> {
  readonly account_id: string;
  readonly object: T;
}

export type ZoomMeetingWebhookEvent = ZoomWebhookEvent<ZoomMeetingPayloadData>;
