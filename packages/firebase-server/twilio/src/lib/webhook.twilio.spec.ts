import { describe, it, expect } from 'vitest';
import { twilioWebhookUrlsForEnvService } from './webhook.twilio';

describe('twilioWebhookUrlsForEnvService()', () => {
  it('builds the urls from the app webhook url', () => {
    const urls = twilioWebhookUrlsForEnvService({ appWebhookUrl: 'https://app.example.com/api/webhook' });

    expect(urls?.baseUrl).toBe('https://app.example.com');
    expect(urls?.statusCallbackUrl).toBe('https://app.example.com/api/webhook/twilio/status');
    expect(urls?.incomingMessageUrl).toBe('https://app.example.com/api/webhook/twilio/incoming');
  });

  it('returns undefined when webhooks are disabled', () => {
    expect(twilioWebhookUrlsForEnvService({ appWebhookUrl: undefined })).toBeUndefined();
  });

  it('returns undefined for a localhost webhook url', () => {
    expect(twilioWebhookUrlsForEnvService({ appWebhookUrl: 'http://localhost:9010/api/webhook' })).toBeUndefined();
  });
});
