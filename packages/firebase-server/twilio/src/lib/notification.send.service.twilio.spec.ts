import { describe, it, expect, vi } from 'vitest';
import { type E164PhoneNumber } from '@dereekb/util';
import { type NotificationMessage, type NotificationMessageContent, type NotificationSendTextMessagesResult } from '@dereekb/firebase';
import { type NotificationTextSendServiceHealthCheckService } from '@dereekb/firebase-server/model';
import { type TwilioMessageStatus, type TwilioSendSmsInput, type TwilioSendSmsResult, type TwilioService } from '@dereekb/nestjs/twilio';
import { TWILIO_NOTIFICATION_BODY_MAX_LENGTH, type TwilioNotificationTextSendServiceConfig, type TwilioNotificationTextSendServiceTemplateBuilder, twilioNotificationTextSendService } from './notification.send.service.twilio';

const PHONE_A = '+15555550100' as E164PhoneNumber;
const PHONE_B = '+15555550101' as E164PhoneNumber;
const PHONE_C = '+15555550102' as E164PhoneNumber;

interface FakeTwilioSendResultOverride {
  readonly status?: TwilioMessageStatus;
  readonly sandboxed?: boolean;
  readonly error?: string;
}

/**
 * Fake TwilioService whose sendBulkSms records every batch and returns a result per input,
 * optionally overridden per recipient phone number.
 *
 * @param overrides - Result overrides keyed by recipient phone number.
 * @returns The fake service and the recorded batches.
 */
function makeFakeTwilioService(overrides: Partial<Record<E164PhoneNumber, FakeTwilioSendResultOverride>> = {}) {
  const batches: TwilioSendSmsInput[][] = [];

  const sendBulkSms = vi.fn(async (inputs: TwilioSendSmsInput[]): Promise<TwilioSendSmsResult[]> => {
    batches.push(inputs);

    return inputs.map((input) => {
      const override = overrides[input.to];

      return {
        sid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        to: input.to,
        status: override?.status ?? 'queued',
        sandboxed: override?.sandboxed ?? false,
        error: override?.error
      };
    });
  });

  const twilioService = { sendBulkSms } as unknown as TwilioService;
  return { twilioService, sendBulkSms, batches };
}

function makeMessage(phone: E164PhoneNumber | undefined, content: Partial<NotificationMessageContent> = {}, textContent?: Partial<NotificationMessageContent>): NotificationMessage {
  return {
    inputContext: { recipient: { uid: 'uid', t: phone } },
    content: { title: 'Title', ...content },
    textContent: textContent ? { title: 'Text title', ...textContent } : undefined
  };
}

async function sendMessages(config: TwilioNotificationTextSendServiceConfig, messages: NotificationMessage[]): Promise<NotificationSendTextMessagesResult> {
  const service = twilioNotificationTextSendService(config);
  const sendInstance = await service.buildSendInstanceForTextNotificationMessages(messages);
  return sendInstance();
}

describe('twilioNotificationTextSendService()', () => {
  describe('default builder', () => {
    it('should join the title, opening message, closing message and action url with newlines', async () => {
      const { twilioService, batches } = makeFakeTwilioService();

      await sendMessages({ twilioService }, [makeMessage(PHONE_A, { title: 'Title', openingMessage: 'Opening', closingMessage: 'Closing', action: 'View', actionUrl: 'https://example.com/a' })]);

      expect(batches).toHaveLength(1);
      expect(batches[0][0].to).toBe(PHONE_A);
      expect(batches[0][0].body).toBe('Title\nOpening\nClosing\nhttps://example.com/a');
    });

    it('should skip unset parts of the content', async () => {
      const { twilioService, batches } = makeFakeTwilioService();

      await sendMessages({ twilioService }, [makeMessage(PHONE_A, { title: 'Title', closingMessage: 'Closing' })]);

      expect(batches[0][0].body).toBe('Title\nClosing');
    });

    it('should use the textContent instead of the content when set', async () => {
      const { twilioService, batches } = makeFakeTwilioService();

      await sendMessages({ twilioService }, [makeMessage(PHONE_A, { title: 'Email title', openingMessage: 'Email opening', actionUrl: 'https://example.com/email' }, { title: 'Text title', actionUrl: 'https://example.com/text' })]);

      expect(batches[0][0].body).toBe('Text title\nhttps://example.com/text');
    });

    it('should truncate the body to the max length', async () => {
      const { twilioService, batches } = makeFakeTwilioService();

      await sendMessages({ twilioService }, [makeMessage(PHONE_A, { title: 'Title', openingMessage: 'a'.repeat(TWILIO_NOTIFICATION_BODY_MAX_LENGTH * 2) })]);

      const body = batches[0][0].body;
      expect(body).toHaveLength(TWILIO_NOTIFICATION_BODY_MAX_LENGTH);
      expect(body.startsWith('Title\naaa')).toBe(true);
    });

    it('should drop a message whose body is empty', async () => {
      const { twilioService, sendBulkSms } = makeFakeTwilioService();

      const result = await sendMessages({ twilioService }, [makeMessage(PHONE_A, { title: '' })]);

      expect(sendBulkSms).not.toHaveBeenCalled();
      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.ignored).toHaveLength(0);
    });

    it('should apply the configured sender and callback defaults', async () => {
      const { twilioService, batches } = makeFakeTwilioService();

      await sendMessages({ twilioService, defaultFrom: PHONE_C, messagingServiceSid: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', statusCallbackUrl: 'https://example.com/webhook/twilio/status' }, [makeMessage(PHONE_A)]);

      expect(batches[0][0].from).toBe(PHONE_C);
      expect(batches[0][0].messagingServiceSid).toBe('MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      expect(batches[0][0].statusCallback).toBe('https://example.com/webhook/twilio/status');
    });
  });

  it('should drop messages without a recipient phone number', async () => {
    const { twilioService, batches } = makeFakeTwilioService();

    const result = await sendMessages({ twilioService }, [makeMessage(undefined), makeMessage(PHONE_A)]);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
    expect(batches[0][0].to).toBe(PHONE_A);
    expect(result.success).toEqual([PHONE_A]);
    expect(result.failed).toHaveLength(0);
    expect(result.ignored).toHaveLength(0);
  });

  describe('results', () => {
    it('should count sent messages as success', async () => {
      const { twilioService } = makeFakeTwilioService();

      const result = await sendMessages({ twilioService }, [makeMessage(PHONE_A), makeMessage(PHONE_B)]);

      expect(result.success).toEqual([PHONE_A, PHONE_B]);
      expect(result.failed).toHaveLength(0);
      expect(result.ignored).toHaveLength(0);
    });

    it('should count sandboxed messages as ignored', async () => {
      const { twilioService } = makeFakeTwilioService({ [PHONE_A]: { sandboxed: true } });

      const result = await sendMessages({ twilioService }, [makeMessage(PHONE_A), makeMessage(PHONE_B)]);

      expect(result.ignored).toEqual([PHONE_A]);
      expect(result.success).toEqual([PHONE_B]);
      expect(result.failed).toHaveLength(0);
    });

    it('should count failed, undelivered and errored messages as failed', async () => {
      const { twilioService } = makeFakeTwilioService({ [PHONE_A]: { status: 'failed' }, [PHONE_B]: { status: 'undelivered' }, [PHONE_C]: { status: 'failed', error: 'Invalid number' } });

      const result = await sendMessages({ twilioService }, [makeMessage(PHONE_A), makeMessage(PHONE_B), makeMessage(PHONE_C)]);

      expect(result.failed).toEqual([PHONE_A, PHONE_B, PHONE_C]);
      expect(result.success).toHaveLength(0);
      expect(result.ignored).toHaveLength(0);
    });
  });

  describe('messageBuilders', () => {
    it('should route messages to the builder matching their send template name', async () => {
      const { twilioService, batches } = makeFakeTwilioService();
      const builder = vi.fn<TwilioNotificationTextSendServiceTemplateBuilder>(({ messages }) => messages.map((x) => ({ to: x.inputContext.recipient.t as E164PhoneNumber, body: 'custom' })));

      await sendMessages({ twilioService, messageBuilders: { Custom: builder } }, [makeMessage(PHONE_A, { sendTemplateName: 'custom' }), makeMessage(PHONE_B)]);

      expect(builder).toHaveBeenCalledTimes(1);
      expect(builder.mock.calls[0][0].sendTemplateName).toBe('custom');
      expect(builder.mock.calls[0][0].messages).toHaveLength(1);

      const bodiesByPhone = Object.fromEntries(batches.flat().map((x) => [x.to, x.body]));
      expect(bodiesByPhone[PHONE_A]).toBe('custom');
      expect(bodiesByPhone[PHONE_B]).toBe('Title');
    });

    it('should prefer the textContent send template name over the content send template name', async () => {
      const { twilioService } = makeFakeTwilioService();
      const textBuilder = vi.fn<TwilioNotificationTextSendServiceTemplateBuilder>(() => []);
      const contentBuilder = vi.fn<TwilioNotificationTextSendServiceTemplateBuilder>(() => []);

      await sendMessages({ twilioService, messageBuilders: { text: textBuilder, content: contentBuilder } }, [makeMessage(PHONE_A, { sendTemplateName: 'content' }, { sendTemplateName: 'text' })]);

      expect(textBuilder).toHaveBeenCalledTimes(1);
      expect(contentBuilder).not.toHaveBeenCalled();
    });

    it('should use the default message builder override for messages without a matching builder', async () => {
      const { twilioService, batches } = makeFakeTwilioService();
      const defaultMessageBuilder = vi.fn<TwilioNotificationTextSendServiceTemplateBuilder>(({ messages }) => messages.map((x) => ({ to: x.inputContext.recipient.t as E164PhoneNumber, body: 'default override' })));

      await sendMessages({ twilioService, defaultMessageBuilder, messageBuilders: { other: () => [] } }, [makeMessage(PHONE_A, { sendTemplateName: 'unknown' })]);

      expect(defaultMessageBuilder).toHaveBeenCalledTimes(1);
      expect(batches[0][0].body).toBe('default override');
    });
  });

  it('should build and send in batches of at most maxBatchSizePerRequest', async () => {
    const { twilioService, batches } = makeFakeTwilioService();
    const builder = vi.fn<TwilioNotificationTextSendServiceTemplateBuilder>(({ messages }) => messages.map((x) => ({ to: x.inputContext.recipient.t as E164PhoneNumber, body: 'batched' })));

    const phones = Array.from({ length: 5 }, (_, i) => `+1555555020${i}` as E164PhoneNumber);
    const result = await sendMessages(
      { twilioService, maxBatchSizePerRequest: 2, defaultMessageBuilder: builder },
      phones.map((x) => makeMessage(x))
    );

    expect(builder.mock.calls.map((x) => x[0].messages.length)).toEqual([2, 2, 1]);
    expect(batches.map((x) => x.length).sort((a, b) => a - b)).toEqual([1, 2, 2]);
    expect([...result.success].sort((a, b) => a.localeCompare(b))).toEqual(phones);
  });

  it('should expose the configured health check service', () => {
    const { twilioService } = makeFakeTwilioService();
    const healthCheckService = { runHealthCheck: vi.fn() } as unknown as NotificationTextSendServiceHealthCheckService;

    expect(twilioNotificationTextSendService({ twilioService, healthCheckService }).healthCheckService).toBe(healthCheckService);
    expect(twilioNotificationTextSendService({ twilioService }).healthCheckService).toBeUndefined();
  });
});
