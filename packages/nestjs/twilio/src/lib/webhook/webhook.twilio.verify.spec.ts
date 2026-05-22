import { describe, it, expect } from 'vitest';
import { type Request } from 'express';
import { getExpectedTwilioSignature } from 'twilio';
import { parseTwilioFormBody, twilioWebhookRequestUrl, twilioWebhookVerifier } from './webhook.twilio.verify';

function makeRequest(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string> = {};
  const req = {
    headers,
    originalUrl: '/webhook/twilio/incoming',
    url: '/webhook/twilio/incoming',
    protocol: 'https',
    get(key: string) {
      if (key === 'host') return 'example.com';
      return undefined;
    },
    ...overrides
  };
  return req as unknown as Request;
}

describe('parseTwilioFormBody()', () => {
  it('parses an x-www-form-urlencoded buffer into a plain record', () => {
    const buffer = Buffer.from('From=%2B15555550123&To=%2B15555550456&Body=hello+world');
    const parsed = parseTwilioFormBody(buffer);
    expect(parsed).toEqual({
      From: '+15555550123',
      To: '+15555550456',
      Body: 'hello world'
    });
  });
});

describe('twilioWebhookRequestUrl()', () => {
  it('uses the provided baseUrl when supplied', () => {
    const url = twilioWebhookRequestUrl(makeRequest({ originalUrl: '/webhook/twilio/status' }), 'https://api.example.com');
    expect(url).toBe('https://api.example.com/webhook/twilio/status');
  });

  it('strips a trailing slash from baseUrl', () => {
    const url = twilioWebhookRequestUrl(makeRequest({ originalUrl: '/webhook/twilio/status' }), 'https://api.example.com/');
    expect(url).toBe('https://api.example.com/webhook/twilio/status');
  });

  it('falls back to request protocol + host when no baseUrl is given', () => {
    const url = twilioWebhookRequestUrl(makeRequest({ originalUrl: '/webhook/twilio/incoming' }));
    expect(url).toBe('https://example.com/webhook/twilio/incoming');
  });

  it('honors x-forwarded-proto and x-forwarded-host headers', () => {
    const req = makeRequest({
      originalUrl: '/webhook/twilio/incoming',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'public.example.com'
      } as Record<string, string>
    });
    const url = twilioWebhookRequestUrl(req);
    expect(url).toBe('https://public.example.com/webhook/twilio/incoming');
  });
});

describe('twilioWebhookVerifier()', () => {
  const authToken = '12345';
  const url = 'https://example.com/webhook/twilio/incoming';
  const params = { From: '+15555550123', To: '+15555550456', Body: 'hello' };
  const bodyString = 'From=%2B15555550123&To=%2B15555550456&Body=hello';

  it('accepts a request whose X-Twilio-Signature matches the body and URL', () => {
    const validSignature = getExpectedTwilioSignature(authToken, url, params);
    const req = makeRequest({
      headers: { 'x-twilio-signature': validSignature } as Record<string, string>
    });

    const verifier = twilioWebhookVerifier({ authToken, baseUrl: 'https://example.com' });
    const result = verifier(req, Buffer.from(bodyString));

    expect(result.valid).toBe(true);
    expect(result.params).toEqual(params);
  });

  it('rejects a request with an invalid X-Twilio-Signature', () => {
    const req = makeRequest({
      headers: { 'x-twilio-signature': 'not-a-real-signature' } as Record<string, string>
    });

    const verifier = twilioWebhookVerifier({ authToken, baseUrl: 'https://example.com' });
    const result = verifier(req, Buffer.from(bodyString));

    expect(result.valid).toBe(false);
    // params are still parsed even on signature failure so callers can log them.
    expect(result.params).toEqual(params);
  });

  it('bypasses verification when skip is true', () => {
    const req = makeRequest({
      headers: { 'x-twilio-signature': 'whatever' } as Record<string, string>
    });

    const verifier = twilioWebhookVerifier({ authToken, skip: true });
    const result = verifier(req, Buffer.from(bodyString));

    expect(result.valid).toBe(true);
  });
});
