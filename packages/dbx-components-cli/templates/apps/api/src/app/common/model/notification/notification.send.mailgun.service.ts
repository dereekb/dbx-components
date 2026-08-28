import { type MailgunNotificationEmailSendService, type MailgunNotificationEmailSendServiceTemplateBuilderInput, mailgunNotificationEmailSendService, mailgunCalendarFileAttachmentForNotificationMessage } from '@dereekb/firebase-server/model';
import { expandMailgunRecipientBatchSendTargetRequestFactory, type MailgunRecipient, type MailgunRecipientBatchSendTarget, type MailgunService, type MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
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

  // Built once rather than per batch, since the configuration is constant.
  //
  // No subject on the base request: "useSubjectFromRecipientUserVariables" templates it for a batched
  // request and resolves it from the recipient for an individual one. No recipientVariablesConfig either,
  // because the template reads the conversion default's "recipient-" prefixed variables.
  const requestFactory = expandMailgunRecipientBatchSendTargetRequestFactory({
    request: {
      replyTo: APP_CODE_PREFIX_CAPS_NOTIFICATION_REPLY_TO_RECIPIENT,
      from: APP_CODE_PREFIX_CAPS_NOTIFICATION_SENDER_RECIPIENT,
      template: APP_CODE_PREFIX_CAPS_NOTIFICATION_ACTION_TEMPLATE_KEY
    },
    allowSingleRecipientBatchSendRequests: true,
    useSubjectFromRecipientUserVariables: true
  });

  const mailgunSendService: MailgunNotificationEmailSendService = mailgunNotificationEmailSendService({
    mailgunService,
    defaultSendTemplateName: APP_CODE_PREFIX_CAPS_NOTIFICATION_ACTION_TEMPLATE_KEY,
    messageBuilders: {
      notificationTemplate: async (input: MailgunNotificationEmailSendServiceTemplateBuilderInput): Promise<MailgunTemplateEmailRequest[]> => {
        const { messages } = input;

        // The recipient is known before the calendar part: the payload's ATTENDEE must name the address we
        // resolved here. Mapped rather than pushed from inside the loop, so the target order stays the
        // message order regardless of which attachment factory settles first.
        const batchSendTargets: MailgunRecipientBatchSendTarget[] = await Promise.all(
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

            const recipient: MailgunRecipientBatchSendTarget = {
              name: inputRecipient.n ?? undefined,
              email: inputRecipient.e as string,
              userVariables: {
                subject,
                ...userVariables
              }
            };

            // An iTIP invite whose ATTENDEE names one recipient cannot ride a batched to[] -- every other
            // recipient of that request would receive an invite addressed to someone else, which no client
            // renders inline. Putting it on the target hands that constraint to the expansion factory, which
            // gives this recipient a request of its own. The cost is granularity: send success/failure is
            // recorded per request.
            const attachments = await mailgunCalendarFileAttachmentForNotificationMessage({ message: x, recipient });

            return attachments ? { ...recipient, attachments } : recipient;
          })
        );

        return requestFactory(batchSendTargets);
      }
    }
  });

  return mailgunSendService;
}
