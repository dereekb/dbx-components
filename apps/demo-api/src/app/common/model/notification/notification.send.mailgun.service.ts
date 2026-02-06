import { type MailgunNotificationEmailSendService, type MailgunNotificationEmailSendServiceTemplateBuilderInput, mailgunNotificationEmailSendService } from '@dereekb/firebase-server/model';
import { type MailgunRecipient, type MailgunService, type MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { type DemoMailgunBasicTemplateData } from './notification.mailgun';
import { type ArrayOrValue } from '@dereekb/util';

export const DEMO_NOTIFICATION_ACTION_TEMPLATE_KEY = 'notificationtemplate';

export const DEFAULT_NOTIFICATION_ACTION_BUTTON_TEXT = `Go To App`;

export const DEMO_NOTIFICATION_REPLY_TO_RECIPIENT: MailgunRecipient = {
  name: 'Example Support',
  email: `support@components.dereekb.com`
};

export const DEMO_NOTIFICATION_SENDER_RECIPIENT: MailgunRecipient = {
  name: 'Example Notification Sender',
  email: `notifications@components.dereekb.com`
};

/**
 * Creates a MailgunNotificationEmailSendService configured for the Demo app.
 *
 * @param mailgunService
 * @returns
 */
export function demoNotificationMailgunSendService(mailgunService: MailgunService): MailgunNotificationEmailSendService {
  const DEFAULT_ACTION_URL = `${mailgunService.mailgunApi.clientUrl}/home`;

  const mailgunSendService: MailgunNotificationEmailSendService = mailgunNotificationEmailSendService({
    mailgunService,
    defaultSendTemplateName: DEMO_NOTIFICATION_ACTION_TEMPLATE_KEY,
    messageBuilders: {
      notificationTemplate: (input: MailgunNotificationEmailSendServiceTemplateBuilderInput): ArrayOrValue<MailgunTemplateEmailRequest> => {
        const { messages } = input;

        const to: MailgunRecipient[] = messages.map((x) => {
          const { recipient: inputRecipient } = x.inputContext;
          const { title, openingMessage, action, actionUrl, from: contentFrom } = x.content;
          const { subject = title, replyTo, replyToEmail, from = contentFrom } = x.emailContent ?? {};

          const userVariables: DemoMailgunBasicTemplateData = {
            ...x.content.templateVariables,
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
          replyTo: DEMO_NOTIFICATION_REPLY_TO_RECIPIENT,
          from: DEMO_NOTIFICATION_SENDER_RECIPIENT,
          template: DEMO_NOTIFICATION_ACTION_TEMPLATE_KEY,
          subject: `%recipient.subject%`
        };

        return request;
      }
    }
  });

  return mailgunSendService;
}
