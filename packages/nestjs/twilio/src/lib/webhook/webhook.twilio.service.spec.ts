import { describe, it, expect, vi } from 'vitest';
import { type Request } from 'express';
import { type TwilioIncomingMessageEvent } from './webhook.twilio';
import { TwilioOptOutType } from './webhook.twilio.optout';
import { TwilioWebhookService } from './webhook.twilio.service';
import { type TwilioWebhookServiceConfig } from './webhook.twilio.config';

function makeService() {
  const config = { twilioWebhook: { authToken: 'test-auth-token', skipVerify: true } } as TwilioWebhookServiceConfig;
  return new TwilioWebhookService(config);
}

function makeRequest(): Request {
  return { headers: {}, originalUrl: '/webhook/twilio/incoming', url: '/webhook/twilio/incoming', protocol: 'https', get: () => 'example.com' } as unknown as Request;
}

describe('TwilioWebhookService', () => {
  describe('handleIncomingMessage()', () => {
    it('should dispatch the parsed incoming message', async () => {
      const service = makeService();
      const handler = vi.fn<(event: TwilioIncomingMessageEvent) => void>();
      service.configure({}, (x) => x.handleIncomingMessage(handler));

      const body = Buffer.from('MessageSid=SM123&AccountSid=AC123&From=%2B15555550123&To=%2B15555550456&Body=STOP&NumMedia=1&MediaUrl0=https%3A%2F%2Fexample.com%2Fa.jpg&MessagingServiceSid=MG123&OptOutType=STOP');
      await service.handleIncomingMessage(makeRequest(), body);

      expect(handler).toHaveBeenCalledTimes(1);

      const { payload } = handler.mock.calls[0][0];
      expect(payload.MessageSid).toBe('SM123');
      expect(payload.From).toBe('+15555550123');
      expect(payload.To).toBe('+15555550456');
      expect(payload.Body).toBe('STOP');
      expect(payload.NumMedia).toBe(1);
      expect(payload.mediaUrls).toEqual(['https://example.com/a.jpg']);
      expect(payload.MessagingServiceSid).toBe('MG123');
      expect(payload.OptOutType).toBe(TwilioOptOutType.STOP);
    });

    it('should leave OptOutType unset when Twilio did not send one', async () => {
      const service = makeService();
      const handler = vi.fn<(event: TwilioIncomingMessageEvent) => void>();
      service.configure({}, (x) => x.handleIncomingMessage(handler));

      await service.handleIncomingMessage(makeRequest(), Buffer.from('MessageSid=SM123&From=%2B15555550123&To=%2B15555550456&Body=hello'));

      const { payload } = handler.mock.calls[0][0];
      expect(payload.Body).toBe('hello');
      expect(payload.NumMedia).toBe(0);
      expect(payload.OptOutType).toBeUndefined();
      expect(payload.MessagingServiceSid).toBeUndefined();
    });
  });
});
