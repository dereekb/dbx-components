import { createHmac } from 'node:crypto';
import { type Request } from 'express';
import { describe, expect, it } from 'vitest';
import { trelloWebhookEventVerifier, trelloWebhookExpectedSignature } from './webhook.trello.verify';

const APP_SECRET = 'test-app-secret';
const CALLBACK_URL = 'https://example.com/webhook/trello';

function makeRequest(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

function makeBody(payload: object): Buffer {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

function expectedSignature(appSecret: string, rawBody: Buffer, callbackUrl: string): string {
  const hmac = createHmac('sha1', appSecret);
  hmac.update(rawBody);
  hmac.update(callbackUrl);
  return hmac.digest('base64');
}

describe('trelloWebhookExpectedSignature()', () => {
  it('computes the documented HMAC-SHA1 over rawBody + callbackUrl', () => {
    const rawBody = makeBody({ action: { type: 'createCard' } });
    const result = trelloWebhookExpectedSignature(APP_SECRET, rawBody, CALLBACK_URL);

    expect(result).toBe(expectedSignature(APP_SECRET, rawBody, CALLBACK_URL));
  });
});

describe('trelloWebhookEventVerifier()', () => {
  const verifier = trelloWebhookEventVerifier({ appSecret: APP_SECRET, callbackUrl: CALLBACK_URL });

  it('accepts events with a valid X-Trello-Webhook signature', () => {
    const payload = { action: { id: 'a', type: 'createCard', date: '2026-05-16T00:00:00Z', idMemberCreator: 'm', data: {} }, model: { id: 'b' }, webhook: { id: 'w', idModel: 'b', callbackURL: CALLBACK_URL, description: '', active: true } };
    const rawBody = makeBody(payload);
    const signature = expectedSignature(APP_SECRET, rawBody, CALLBACK_URL);

    const result = verifier(makeRequest({ 'x-trello-webhook': signature }), rawBody);

    expect(result.valid).toBe(true);
    expect(result.event).toEqual(payload);
  });

  it('rejects events with a mismatched signature', () => {
    const payload = { action: { type: 'updateCard' } };
    const rawBody = makeBody(payload);

    const result = verifier(makeRequest({ 'x-trello-webhook': 'tampered-signature' }), rawBody);

    expect(result.valid).toBe(false);
    expect(result.event).toBeUndefined();
  });

  it('rejects events with a missing signature header', () => {
    const result = verifier(makeRequest({}), makeBody({ action: { type: 'noop' } }));

    expect(result.valid).toBe(false);
    expect(result.event).toBeUndefined();
  });

  it('rejects events with a signature computed against a different callback URL', () => {
    const payload = { action: { type: 'createCard' } };
    const rawBody = makeBody(payload);
    const signature = expectedSignature(APP_SECRET, rawBody, 'https://other.example.com/webhook/trello');

    const result = verifier(makeRequest({ 'x-trello-webhook': signature }), rawBody);

    expect(result.valid).toBe(false);
  });

  it('rejects events with non-JSON bodies even when signed', () => {
    const rawBody = Buffer.from('not-json');
    const signature = expectedSignature(APP_SECRET, rawBody, CALLBACK_URL);

    const result = verifier(makeRequest({ 'x-trello-webhook': signature }), rawBody);

    expect(result.valid).toBe(false);
  });
});
