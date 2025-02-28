import { type NotificationMessage, type NotificationSendTextMessagesResult } from '@dereekb/firebase';
import { type NotificationTextSendService } from './notification.send.service';
import { type NotificationSendMessagesInstance } from './notification.send';
import { type E164PhoneNumber } from '@dereekb/util';

/**
 * NotificationTextSendService that ignores sending all messages.
 *
 * This is useful for cases where your app may eventually want to send text notifications and want the rest of your app configured like it currently does.
 *
 * @returns
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
