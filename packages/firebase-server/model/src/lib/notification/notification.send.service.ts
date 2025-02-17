import { type NotificationMessage } from '@dereekb/firebase';
import { NotificationSendEmailMessagesResult, NotificationSendTextMessagesResult, type NotificationSendMessagesInstance, NotificationSendNotificationSummaryMessagesResult } from './notification.send';
import { type Maybe } from '@dereekb/util';

/**
 * Provides a reference to a NotificationSendService instance.
 */
export interface NotificationSendServiceRef {
  readonly notificationSendService: NotificationSendService;
}

/**
 * Service dedicated to providing access to NotificationMessageFunctionFactory values for specific NotificationTemplateTypes.
 */
export abstract class NotificationSendService {
  /**
   * NotificationEmailSendService instance, if emails are configured for this server.
   */
  abstract readonly emailSendService?: Maybe<NotificationEmailSendService>;
  /**
   * NotificationTextSendService instance, if texts are configured for this server.
   */
  abstract readonly textSendService?: Maybe<NotificationTextSendService>;
  /**
   * NotificationTextSendService instance, if texts are configured for this server.
   */
  abstract readonly notificationSummarySendService?: Maybe<NotificationSummarySendService>;
}

/**
 * Service dedicated to sending notification email messages.
 */
export interface NotificationEmailSendService {
  /**
   * Creates a NotificationSendInstance from the input messages.
   *
   * Can throw an error if the messages cannot be sent or generated properly due to a configuration error.
   */
  buildSendInstanceForEmailNotificationMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance<NotificationSendEmailMessagesResult>>;
}

/**
 * Service dedicated to sending notification text messages.
 */
export interface NotificationTextSendService {
  /**
   * Creates a NotificationSendInstance from the input messages.
   *
   * Can throw an error if the messages cannot be sent or generated properly due to a configuration error.
   */
  buildSendInstanceForTextNotificationMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance<NotificationSendTextMessagesResult>>;
}

/**
 * Service dedicated to sending/updating NotificationSummary values in the system for the input messages.
 */
export interface NotificationSummarySendService {
  /**
   * Creates a NotificationSendInstance from the input messages.
   *
   * Can throw an error if the messages cannot be sent or generated properly due to a configuration error.
   */
  buildSendInstanceForNotificationSummaryMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance<NotificationSendNotificationSummaryMessagesResult>>;
}
