import { MailgunNotificationEmailSendService, MailgunNotificationEmailSendServiceTemplateBuilderInput, mailgunNotificationEmailSendService } from '@dereekb/firebase-server/model';
import { MailgunRecipient, MailgunService, MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { APP_CODE_PREFIXMailgunBasicTemplateData } from './notification.mailgun';

export const APP_CODE_PREFIX_CAPS_NOTIFICATION_ACTION_TEMPLATE_KEY = 'notificationtemplate';

export const DEFAULT_NOTIFICATION_ACTION_BUTTON_TEXT = `Go To App`;

export const APP_CODE_PREFIX_CAPS_NOTIFICATION_REPLY_TO_RECIPIENT: MailgunRecipient = {
  name: 'Example Support',
  email: `support@components.dereekb.com`
};

export const APP_CODE_PREFIX_CAPS_NOTIFICATION_SENDER_RECIPIENT: MailgunRecipient = {
  name: 'Example Notification Sender',
  email: `notifications@components.dereekb.com`
};

/**
 * Creates a MailgunNotificationEmailSendService configured for the APP_CODE_PREFIX app.
 *
 * @param mailgunService
 * @returns
 */
export function APP_CODE_PREFIXNotificationMailgunSendService(mailgunService: MailgunService): MailgunNotificationEmailSendService {
  const DEFAULT_ACTION_URL = `${mailgunService.mailgunApi.clientUrl}/home`;

  const mailgunSendService: MailgunNotificationEmailSendService = mailgunNotificationEmailSendService({
    mailgunService,
    defaultSendTemplateName: APP_CODE_PREFIX_CAPS_NOTIFICATION_ACTION_TEMPLATE_KEY,
    messageBuilders: {
      notificationTemplate: (input: MailgunNotificationEmailSendServiceTemplateBuilderInput): MailgunTemplateEmailRequest => {
        const { messages } = input;

        const to: MailgunRecipient[] = messages.map((x) => {
          const { recipient: inputRecipient } = x.inputContext;
          const { title, openingMessage, action, actionUrl } = x.content;
          const { subject = title } = x.emailContent ?? {};

          const userVariables: APP_CODE_PREFIXMailgunBasicTemplateData = {
            title,
            line1: openingMessage ?? '',
            text: action || DEFAULT_NOTIFICATION_ACTION_BUTTON_TEXT,
            url: actionUrl || DEFAULT_ACTION_URL
          };

          const recipient: MailgunRecipient = {
            name: inputRecipient.n ?? undefined,
            email: x.inputContext.recipient.e as string,
            userVariables: {
              subject,
              ...userVariables
            }
          };

          return recipient;
        });

        const request: MailgunTemplateEmailRequest = {
          to,
          replyTo: APP_CODE_PREFIX_CAPS_NOTIFICATION_REPLY_TO_RECIPIENT,
          from: APP_CODE_PREFIX_CAPS_NOTIFICATION_SENDER_RECIPIENT,
          template: APP_CODE_PREFIX_CAPS_NOTIFICATION_ACTION_TEMPLATE_KEY,
          subject: `%recipient.subject%`
        };

        return request;
      }
    }
  });

  return mailgunSendService;
}
