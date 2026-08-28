import { type MailgunNotificationEmailSendService, type MailgunNotificationEmailSendServiceTemplateBuilderInput, mailgunNotificationEmailSendService, mailgunCalendarFileAttachmentForNotificationMessage } from '@dereekb/firebase-server/model';
import { type MailgunRecipient, type MailgunService, type MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { type ArrayOrValue } from '@dereekb/util';
import { type APP_CODE_PREFIXMailgunBasicTemplateData } from './notification.mailgun';

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
      notificationTemplate: async (input: MailgunNotificationEmailSendServiceTemplateBuilderInput): Promise<ArrayOrValue<MailgunTemplateEmailRequest>> => {
        const { messages } = input;

        const requestBase = {
          replyTo: APP_CODE_PREFIX_CAPS_NOTIFICATION_REPLY_TO_RECIPIENT,
          from: APP_CODE_PREFIX_CAPS_NOTIFICATION_SENDER_RECIPIENT,
          template: APP_CODE_PREFIX_CAPS_NOTIFICATION_ACTION_TEMPLATE_KEY,
          subject: `%recipient.subject%`
        };

        // The recipient is known before the calendar part: the payload's ATTENDEE must name the address we
        // resolved here. Mapped rather than pushed from inside the loop, so the request order stays the
        // message order regardless of which attachment factory settles first.
        const builtMessages = await Promise.all(
          messages.map(async (x) => {
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
              email: inputRecipient.e as string,
              userVariables: {
                subject,
                ...userVariables
              }
            };

            const calendarAttachment = await mailgunCalendarFileAttachmentForNotificationMessage({ message: x, recipient });

            return { recipient, calendarAttachment };
          })
        );

        const requests: MailgunTemplateEmailRequest[] = [];
        const batchedTo: MailgunRecipient[] = [];

        builtMessages.forEach(({ recipient, calendarAttachment }) => {
          if (calendarAttachment) {
            // FAN OUT. Attachments live on the REQUEST and MailgunRecipient has no per-recipient attachment
            // slot, so an iTIP invite whose ATTENDEE names one recipient cannot ride a batched to[] -- every
            // other recipient of that request would receive an invite addressed to someone else, which no
            // client renders inline. The cost is granularity: send success/failure is recorded per request.
            requests.push({ ...requestBase, to: recipient, attachments: calendarAttachment });
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
