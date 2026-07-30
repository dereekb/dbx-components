import { type MailgunNotificationEmailSendService, type MailgunNotificationHealthCheckProbeBuilderInput, type MailgunNotificationEmailSendServiceTemplateBuilderInput, mailgunNotificationEmailSendService, mailgunNotificationEmailSendServiceHealthCheckService } from '@dereekb/firebase-server/model';
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
          const { subject = title, replyTo: _replyTo, replyToEmail: _replyToEmail, from: _from = contentFrom } = x.emailContent ?? {};

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

  return {
    ...mailgunSendService,
    healthCheckService: mailgunNotificationEmailSendServiceHealthCheckService({
      mailgunService,
      probeBuilder: demoNotificationHealthCheckProbeRequest
    })
  };
}
