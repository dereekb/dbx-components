import { type NotificationSummaryIdForUidFunction, type NotificationMessage, type NotificationSendEmailMessagesResult, type NotificationSendNotificationSummaryMessagesResult, type NotificationSendTextMessagesResult } from '@dereekb/firebase';
import { type NotificationSendMessagesInstance } from './notification.send';
import { type NotificationEmailSendServiceHealthCheckService, type NotificationSummarySendServiceHealthCheckService, type NotificationTextSendServiceHealthCheckService } from './notification.healthcheck.service';
import { type Maybe } from '@dereekb/util';

/**
 * Provides a reference to a NotificationSendService instance.
 */
export interface NotificationSendServiceRef {
  readonly notificationSendService: NotificationSendService;
}

/**
 * Abstract service that orchestrates notification delivery across multiple channels (email, SMS, notification summaries).
 *
 * Implementations provide the channel-specific send services and optionally a function to derive
 * {@link NotificationSummaryId} values from UIDs for in-app notification storage.
 *
 * Used by {@link NotificationServerActions} during the `sendNotification` flow to build
 * and dispatch messages to all applicable channels.
 */
export abstract class NotificationSendService {
  /**
   * NotificationSummaryIdForUidFunction if this app should/will create NotificationSummary values for each user.
   *
   * If not defined, then sent notifications to recipients with UIDs will
   */
  abstract readonly notificationSummaryIdForUidFunction?: Maybe<NotificationSummaryIdForUidFunction>;
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
  /**
   * Optional. Contributes provider-specific diagnostics for the email channel to a notification
   * delivery health check.
   *
   * When absent, a health check reports only what it can determine from configuration and send history.
   */
  readonly healthCheckService?: Maybe<NotificationEmailSendServiceHealthCheckService>;
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
  /**
   * Optional. Contributes provider-specific diagnostics for the text/SMS channel to a notification
   * delivery health check.
   *
   * When absent, a health check reports only what it can determine from configuration and send history.
   */
  readonly healthCheckService?: Maybe<NotificationTextSendServiceHealthCheckService>;
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
  /**
   * Optional. Contributes diagnostics for the in-app notification summary channel to a notification
   * delivery health check.
   *
   * When absent, a health check reports only what it can determine from configuration and send history.
   */
  readonly healthCheckService?: Maybe<NotificationSummarySendServiceHealthCheckService>;
}
