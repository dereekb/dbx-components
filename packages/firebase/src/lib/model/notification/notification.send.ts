import { type Maybe, type EmailAddress, type E164PhoneNumber } from '@dereekb/util';
import { type NotificationSummaryId } from './notification.id';

export interface NotificationSendMessagesResult<K> {
  /**
   * Set of all successful recipients.
   */
  readonly success: K[];
  /**
   * Set of all failed recipients.
   *
   * A failed recipient is a valid recipient that failed due to a temporary error and should be retried again it the future.
   */
  readonly failed: K[];
  /**
   * Set of all ignored recipients, if applicable..
   */
  readonly ignored: K[];
}

export function mergeNotificationSendMessagesResult<K>(a: Maybe<NotificationSendMessagesResult<K>>, b: Maybe<NotificationSendMessagesResult<K>>): NotificationSendMessagesResult<K> {
  return {
    success: [...(a?.success ?? []), ...(b?.success ?? [])],
    failed: [...(a?.failed ?? []), ...(b?.failed ?? [])],
    ignored: [...(a?.ignored ?? []), ...(b?.ignored ?? [])]
  };
}

export type NotificationSendEmailMessagesResult = NotificationSendMessagesResult<EmailAddress>;

export type NotificationSendTextMessagesResult = NotificationSendMessagesResult<E164PhoneNumber>;

export type NotificationSendNotificationSummaryMessagesResult = NotificationSendMessagesResult<NotificationSummaryId>;
