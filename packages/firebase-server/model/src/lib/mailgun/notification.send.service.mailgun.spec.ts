import { describe, expect, it, vi } from 'vitest';
import { type NotificationMessage } from '@dereekb/firebase';
import { type MailgunService, type MailgunTemplateEmailRequest } from '@dereekb/nestjs/mailgun';
import { mailgunNotificationEmailSendService } from './notification.send.service.mailgun';

const TEMPLATE_NAME = 'notificationtemplate';

function messageForRecipient(email: string): NotificationMessage {
  return {
    inputContext: { recipient: { e: email } },
    content: { title: 'Hello' }
  };
}

/**
 * A MailgunService stub that records the requests it is asked to send. Only `sendTemplateEmail` is
 * exercised by the send instance; the rest of the service is never reached.
 */
function stubMailgunService() {
  const sent: MailgunTemplateEmailRequest[] = [];

  const mailgunService = {
    sendTemplateEmail: vi.fn(async (request: MailgunTemplateEmailRequest) => {
      sent.push(request);
      return undefined;
    })
  } as unknown as MailgunService;

  return { mailgunService, sent };
}

describe('mailgunNotificationEmailSendService()', () => {
  it('should await an async template builder, so a builder that renders a calendar part per recipient still dispatches', async () => {
    const { mailgunService, sent } = stubMailgunService();

    const sendService = mailgunNotificationEmailSendService({
      mailgunService,
      defaultSendTemplateName: TEMPLATE_NAME,
      messageBuilders: {
        // async is the shape a builder takes once it renders calendar attachments, since the attachment
        // factory returns a PromiseOrValue -- an unawaited promise here would send nothing at all
        [TEMPLATE_NAME]: async ({ messages }) => {
          const requests: MailgunTemplateEmailRequest[] = messages.map((x) => ({
            to: { email: x.inputContext.recipient.e as string },
            template: TEMPLATE_NAME,
            subject: x.content.title
          }));

          return requests;
        }
      }
    });

    const sendInstance = await sendService.buildSendInstanceForEmailNotificationMessages([messageForRecipient('a@components.dereekb.com'), messageForRecipient('b@components.dereekb.com')]);
    const result = await sendInstance();

    expect(sent).toHaveLength(2);
    expect(result.success).toEqual(['a@components.dereekb.com', 'b@components.dereekb.com']);
    expect(result.failed).toEqual([]);
  });

  it('should record success per request, which is the granularity cost of fanning out', async () => {
    const { mailgunService, sent } = stubMailgunService();

    const sendService = mailgunNotificationEmailSendService({
      mailgunService,
      defaultSendTemplateName: TEMPLATE_NAME,
      messageBuilders: {
        // one fanned-out request naming a single recipient, plus one batched request naming the rest
        [TEMPLATE_NAME]: async ({ messages }) => [
          { to: { email: messages[0].inputContext.recipient.e as string }, template: TEMPLATE_NAME, subject: 'invite' },
          { to: messages.slice(1).map((x) => ({ email: x.inputContext.recipient.e as string })), template: TEMPLATE_NAME, subject: 'batched' }
        ]
      }
    });

    const sendInstance = await sendService.buildSendInstanceForEmailNotificationMessages([messageForRecipient('invited@components.dereekb.com'), messageForRecipient('b@components.dereekb.com'), messageForRecipient('c@components.dereekb.com')]);
    const result = await sendInstance();

    expect(sent).toHaveLength(2);
    expect(result.success).toHaveLength(3);
    expect(result.success).toContain('invited@components.dereekb.com');
  });
});
