import { generateKeyPairSync, sign } from 'node:crypto';
import { discordWebhookEventVerifier } from './webhook.discord.verify';
import { type Request } from 'express';

describe('discordWebhookEventVerifier', () => {
  // Generate an Ed25519 key pair for testing.
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');

  const verifier = discordWebhookEventVerifier({ publicKey: publicKeyHex });

  function makeSignedRequest(body: object, timestamp: string): { req: Partial<Request>; rawBody: Buffer } {
    const rawBody = Buffer.from(JSON.stringify(body));
    const message = Buffer.concat([Buffer.from(timestamp), rawBody]);
    const signature = sign(null, message, privateKey);

    const req: Partial<Request> = {
      headers: {
        'x-signature-ed25519': signature.toString('hex'),
        'x-signature-timestamp': timestamp
      } as any
    };

    return { req, rawBody };
  }

  it('should verify a validly signed request', async () => {
    const body = { type: 1, id: '123' };
    const timestamp = '1234567890';
    const { req, rawBody } = makeSignedRequest(body, timestamp);

    const result = await verifier(req as Request, rawBody);

    expect(result.valid).toBe(true);

    if (result.valid) {
      expect(result.body).toEqual(body);
    }
  });

  it('should reject a request with an invalid signature', async () => {
    const body = { type: 1, id: '123' };
    const rawBody = Buffer.from(JSON.stringify(body));

    const req: Partial<Request> = {
      headers: {
        'x-signature-ed25519': 'deadbeef'.repeat(16),
        'x-signature-timestamp': '1234567890'
      } as any
    };

    const result = await verifier(req as Request, rawBody);
    expect(result.valid).toBe(false);
  });

  it('should reject a request with a tampered body', async () => {
    const originalBody = { type: 1, id: '123' };
    const timestamp = '1234567890';
    const { req } = makeSignedRequest(originalBody, timestamp);

    const tamperedBody = Buffer.from(JSON.stringify({ type: 1, id: '456' }));

    const result = await verifier(req as Request, tamperedBody);
    expect(result.valid).toBe(false);
  });

  it('should reject a request with missing signature header', async () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 1 }));

    const req: Partial<Request> = {
      headers: {
        'x-signature-timestamp': '1234567890'
      } as any
    };

    const result = await verifier(req as Request, rawBody);
    expect(result.valid).toBe(false);
  });

  it('should reject a request with missing timestamp header', async () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 1 }));

    const req: Partial<Request> = {
      headers: {
        'x-signature-ed25519': 'deadbeef'.repeat(16)
      } as any
    };

    const result = await verifier(req as Request, rawBody);
    expect(result.valid).toBe(false);
  });

  it('should reject a request with no headers', async () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 1 }));

    const req: Partial<Request> = {
      headers: {} as any
    };

    const result = await verifier(req as Request, rawBody);
    expect(result.valid).toBe(false);
  });
});
