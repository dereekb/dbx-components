import { type NotificationMessage, type NotificationSendTextMessagesResult } from '@dereekb/firebase';
import { type NotificationTextSendService } from './notification.send.service';
import { type NotificationSendMessagesInstance } from './notification.send';
import { type E164PhoneNumber } from '@dereekb/util';

/**
 * Creates a no-op {@link NotificationTextSendService} that marks all messages as ignored
 * without actually sending any SMS.
 *
 * Useful as a placeholder when your app's notification pipeline is fully wired for SMS
 * but actual delivery is not yet enabled, avoiding the need for conditional logic elsewhere.
 *
 * @returns a {@link NotificationTextSendService} that ignores all messages without sending
 *
 * @example
 * ```ts
 * const textService = ignoreSendNotificationTextSendService();
 * const sendInstance = await textService.buildSendInstanceForTextNotificationMessages(messages);
 * const result = await sendInstance();
 * // result.ignored contains all phone numbers; result.success and result.failed are empty
 * ```
 */
export function ignoreSendNotificationTextSendService(): NotificationTextSendService {
  const sendService: NotificationTextSendService = {
    async buildSendInstanceForTextNotificationMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance<NotificationSendTextMessagesResult>> {
      return async () => {
        const success: E164PhoneNumber[] = [];
        const failed: E164PhoneNumber[] = [];
        const ignored: E164PhoneNumber[] = notificationMessages.map((x) => x.inputContext.recipient.t as E164PhoneNumber);

        const sendResult: NotificationSendTextMessagesResult = {
          success,
          failed,
          ignored
        };

        return sendResult;
      };
    }
  };

  return sendService;
}
