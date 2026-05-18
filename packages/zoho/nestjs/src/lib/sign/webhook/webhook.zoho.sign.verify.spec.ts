import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { type Request } from 'express';
import { ZOHO_SIGN_WEBHOOK_SIGNATURE_HEADER, zohoSignWebhookEventVerifier } from './webhook.zoho.sign.verify';

function makeRequest(headers: Record<string, string | undefined>): Request {
  return { headers } as unknown as Request;
}

function makePayload(): { readonly raw: Buffer; readonly text: string } {
  const text = JSON.stringify({
    request_id: 'req-1',
    request_name: 'test',
    request_status: 'completed',
    request_type_id: 'rt-1',
    notifications: {
      performed_by_email: 'user@example.com',
      performed_by_name: 'Test User',
      performed_at: 1700000000000,
      activity: 'Signed',
      operation_type: 'RequestSigningSuccess'
    }
  });
  return { raw: Buffer.from(text, 'utf-8'), text };
}

function computeSignature(secret: string, raw: Buffer): string {
  return createHmac('sha256', secret).update(raw.toString('utf-8'), 'utf-8').digest('base64');
}

describe('zohoSignWebhookEventVerifier()', () => {
  const secret = 'test-secret';

  it('should return invalid when the signature header is missing', async () => {
    const verifier = zohoSignWebhookEventVerifier({ secret });
    const { raw } = makePayload();
    const result = await verifier(makeRequest({}), raw);
    expect(result.valid).toBe(false);
  });

  it('should return invalid when the signature does not match', async () => {
    const verifier = zohoSignWebhookEventVerifier({ secret });
    const { raw } = makePayload();
    const result = await verifier(makeRequest({ [ZOHO_SIGN_WEBHOOK_SIGNATURE_HEADER]: 'aW52YWxpZA==' }), raw);
    expect(result.valid).toBe(false);
  });

  it('should return valid + parsed event when the signature matches', async () => {
    const verifier = zohoSignWebhookEventVerifier({ secret });
    const { raw } = makePayload();
    const signature = computeSignature(secret, raw);
    const result = await verifier(makeRequest({ [ZOHO_SIGN_WEBHOOK_SIGNATURE_HEADER]: signature }), raw);
    expect(result.valid).toBe(true);
  });

  it('should return invalid when payload JSON cannot be parsed', async () => {
    const verifier = zohoSignWebhookEventVerifier({ secret });
    const raw = Buffer.from('not-json', 'utf-8');
    const signature = computeSignature(secret, raw);
    const result = await verifier(makeRequest({ [ZOHO_SIGN_WEBHOOK_SIGNATURE_HEADER]: signature }), raw);
    expect(result.valid).toBe(false);
  });
});
