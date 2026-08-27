import { MailgunNotificationEmailSendService, MailgunNotificationEmailSendServiceTemplateBuilderInput, mailgunNotificationEmailSendService, notificationMessageCalendarAttachmentToMailgunFileAttachment } from '@dereekb/firebase-server/model';
import { MailgunRecipient, MailgunService, MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { ArrayOrValue } from '@dereekb/util';
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
      notificationTemplate: (input: MailgunNotificationEmailSendServiceTemplateBuilderInput): ArrayOrValue<MailgunTemplateEmailRequest> => {
        const { messages } = input;

        const requestBase = {
          replyTo: APP_CODE_PREFIX_CAPS_NOTIFICATION_REPLY_TO_RECIPIENT,
          from: APP_CODE_PREFIX_CAPS_NOTIFICATION_SENDER_RECIPIENT,
          template: APP_CODE_PREFIX_CAPS_NOTIFICATION_ACTION_TEMPLATE_KEY,
          subject: `%recipient.subject%`
        };

        const requests: MailgunTemplateEmailRequest[] = [];
        const batchedTo: MailgunRecipient[] = [];

        messages.forEach((x) => {
          const { recipient: inputRecipient } = x.inputContext;
          const { title, openingMessage, action, actionUrl } = x.content;
          const { subject = title, calendarAttachment } = x.emailContent ?? {};

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

          if (calendarAttachment) {
            // FAN OUT. Attachments live on the REQUEST and MailgunRecipient has no per-recipient attachment
            // slot, so an iTIP invite whose ATTENDEE names one recipient cannot ride a batched to[] -- every
            // other recipient of that request would receive an invite addressed to someone else, which no
            // client renders inline. The cost is granularity: send success/failure is recorded per request.
            requests.push({ ...requestBase, to: recipient, attachments: notificationMessageCalendarAttachmentToMailgunFileAttachment(calendarAttachment) });
          } else {
            batchedTo.push(recipient);
          }
        });

        if (batchedTo.length) {
          requests.push({ ...requestBase, to: batchedTo });
        }

        return requests;
      }
    }
  });

  return mailgunSendService;
}
