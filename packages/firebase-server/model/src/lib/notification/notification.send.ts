import { NotificationSummaryId } from '@dereekb/firebase';
import { E164PhoneNumber, EmailAddress, Maybe } from '@dereekb/util';

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
  readonly ignored?: Maybe<K[]>;
}

export type NotificationSendEmailMessagesResult = NotificationSendMessagesResult<EmailAddress>;

export type NotificationSendTextMessagesResult = NotificationSendMessagesResult<E164PhoneNumber>;

export type NotificationSendNotificationSummaryMessagesResult = NotificationSendMessagesResult<NotificationSummaryId>;

/**
 * A function that is pre-configured to send the configured notification messages.
 */
export type NotificationSendMessagesInstance<R> = () => Promise<R>;
