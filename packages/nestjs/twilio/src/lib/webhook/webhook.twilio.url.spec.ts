import { describe, it, expect } from 'vitest';
import { twilioWebhookUrls } from './webhook.twilio.url';

describe('twilioWebhookUrls()', () => {
  it('builds the urls from a webhook url under a path prefix', () => {
    const urls = twilioWebhookUrls('https://app.example.com/api/webhook');

    expect(urls.baseUrl).toBe('https://app.example.com');
    expect(urls.statusCallbackUrl).toBe('https://app.example.com/api/webhook/twilio/status');
    expect(urls.incomingMessageUrl).toBe('https://app.example.com/api/webhook/twilio/incoming');
  });

  it('builds the urls from a webhook url with a trailing slash', () => {
    const urls = twilioWebhookUrls('https://api.example.com/webhook/');

    expect(urls.baseUrl).toBe('https://api.example.com');
    expect(urls.statusCallbackUrl).toBe('https://api.example.com/webhook/twilio/status');
  });
});
