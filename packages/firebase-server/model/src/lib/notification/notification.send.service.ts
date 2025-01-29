import { NotificationMessage } from '@dereekb/firebase';
import { NotificationSendMessagesInstance } from './notification.send';
import { Maybe } from '@dereekb/util';

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
  buildSendInstanceForEmailNotificationMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance>;
}
