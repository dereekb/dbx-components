import {
  type MailgunNotificationEmailSendService,
  type MailgunNotificationHealthCheckProbeBuilderInput,
  type MailgunNotificationEmailSendServiceTemplateBuilderInput,
  mailgunNotificationEmailSendService,
  mailgunNotificationEmailSendServiceHealthCheckService,
  mailgunCalendarFileAttachmentForNotificationMessage
} from '@dereekb/firebase-server/model';
import { expandMailgunRecipientBatchSendTargetRequestFactory, type MailgunRecipient, type MailgunRecipientBatchSendTarget, type MailgunService, type MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { type DemoMailgunBasicTemplateData } from './notification.mailgun';

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
 * Builds the test email dispatched when a user runs a delivery health check with probing enabled.
 *
 * This arrives in a real inbox because someone asked the system to check whether their email works, so
 * it says exactly that rather than looking like an ordinary notification.
 *
 * @param input - The probe recipient and Mailgun service.
 * @returns The probe email request.
 */
export function demoNotificationHealthCheckProbeRequest(input: MailgunNotificationHealthCheckProbeBuilderInput): MailgunTemplateEmailRequest {
  const { mailgunService, recipient } = input;
  const title = 'Email delivery test';

  const userVariables: DemoMailgunBasicTemplateData = {
    title,
    line1: 'This is a test message confirming that we can deliver email to this address. No action is needed.',
    text: DEFAULT_NOTIFICATION_ACTION_BUTTON_TEXT,
    url: `${mailgunService.mailgunApi.clientUrl}/home`
  };

  return {
    to: { ...recipient, userVariables: { subject: title, ...userVariables } },
    replyTo: DEMO_NOTIFICATION_REPLY_TO_RECIPIENT,
    from: DEMO_NOTIFICATION_SENDER_RECIPIENT,
    template: DEMO_NOTIFICATION_ACTION_TEMPLATE_KEY,
    subject: `%recipient.subject%`
  };
}

/**
 * Creates a {@link MailgunNotificationEmailSendService} configured for the Demo app.
 *
 * @param mailgunService - The Mailgun service the requests are sent through.
 * @returns The send service, with the delivery health check probe attached.
 */
export function demoNotificationMailgunSendService(mailgunService: MailgunService): MailgunNotificationEmailSendService {
  const DEFAULT_ACTION_URL = `${mailgunService.mailgunApi.clientUrl}/home`;

  // Built once rather than per batch, since the configuration is constant.
  //
  // No subject on the base request: "useSubjectFromRecipientUserVariables" templates it for a batched
  // request and resolves it from the recipient for an individual one. No recipientVariablesConfig either,
  // because the demo template reads the conversion default's "recipient-" prefixed variables.
  const requestFactory = expandMailgunRecipientBatchSendTargetRequestFactory({
    request: {
      replyTo: DEMO_NOTIFICATION_REPLY_TO_RECIPIENT,
      from: DEMO_NOTIFICATION_SENDER_RECIPIENT,
      template: DEMO_NOTIFICATION_ACTION_TEMPLATE_KEY
    },
    allowSingleRecipientBatchSendRequests: true,
    useSubjectFromRecipientUserVariables: true
  });

  const mailgunSendService: MailgunNotificationEmailSendService = mailgunNotificationEmailSendService({
    mailgunService,
    defaultSendTemplateName: DEMO_NOTIFICATION_ACTION_TEMPLATE_KEY,
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

            const userVariables: DemoMailgunBasicTemplateData = {
              ...x.content.templateVariables,
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

            // An invite whose ATTENDEE names one recipient cannot ride a batched to[] -- every other
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

  return {
    ...mailgunSendService,
    healthCheckService: mailgunNotificationEmailSendServiceHealthCheckService({
      mailgunService,
      probeBuilder: demoNotificationHealthCheckProbeRequest
    })
  };
}
