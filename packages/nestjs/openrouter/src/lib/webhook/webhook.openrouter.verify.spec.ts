import { describe, it, expect } from 'vitest';
import { type Request } from 'express';
import { openRouterWebhookEventVerifier, safeCompareOpenRouterWebhookToken, stripOpenRouterWebhookScheme } from './webhook.openrouter.verify';

function makeRequest(headers: Record<string, string | string[]> = {}): Request {
  return { headers } as unknown as Request;
}

const SECRET = 'super-secret-token-value';

describe('safeCompareOpenRouterWebhookToken()', () => {
  it('returns true for byte-for-byte equal tokens', () => {
    expect(safeCompareOpenRouterWebhookToken(SECRET, SECRET)).toBe(true);
  });

  it('returns false for different tokens of equal length', () => {
    const other = 'x'.repeat(SECRET.length);
    expect(other.length).toBe(SECRET.length);
    expect(safeCompareOpenRouterWebhookToken(other, SECRET)).toBe(false);
  });

  it('returns false (without throwing) for tokens of differing length', () => {
    expect(safeCompareOpenRouterWebhookToken('short', SECRET)).toBe(false);
    expect(safeCompareOpenRouterWebhookToken('', SECRET)).toBe(false);
  });
});

describe('stripOpenRouterWebhookScheme()', () => {
  it('strips the scheme prefix case-insensitively', () => {
    expect(stripOpenRouterWebhookScheme('Bearer abc', 'Bearer')).toBe('abc');
    expect(stripOpenRouterWebhookScheme('bearer abc', 'Bearer')).toBe('abc');
    expect(stripOpenRouterWebhookScheme('BEARER abc', 'bearer')).toBe('abc');
  });

  it('trims surrounding whitespace', () => {
    expect(stripOpenRouterWebhookScheme('  Bearer   abc  ', 'Bearer')).toBe('abc');
  });

  it('leaves the value untouched when no scheme is configured', () => {
    expect(stripOpenRouterWebhookScheme('Bearer abc', null)).toBe('Bearer abc');
    expect(stripOpenRouterWebhookScheme('abc', '')).toBe('abc');
  });

  it('leaves the value untouched when the prefix does not match', () => {
    expect(stripOpenRouterWebhookScheme('Token abc', 'Bearer')).toBe('Token abc');
  });
});

describe('openRouterWebhookEventVerifier()', () => {
  it('accepts a request whose default authorization header carries the Bearer secret', () => {
    const verifier = openRouterWebhookEventVerifier({ secret: SECRET });
    const result = verifier(makeRequest({ authorization: `Bearer ${SECRET}` }));
    expect(result.valid).toBe(true);
  });

  it('rejects a request with the wrong token', () => {
    const verifier = openRouterWebhookEventVerifier({ secret: SECRET });
    const result = verifier(makeRequest({ authorization: 'Bearer not-the-secret' }));
    expect(result.valid).toBe(false);
  });

  it('rejects a request with no secret header', () => {
    const verifier = openRouterWebhookEventVerifier({ secret: SECRET });
    const result = verifier(makeRequest({}));
    expect(result.valid).toBe(false);
  });

  it('accepts a custom header name', () => {
    const verifier = openRouterWebhookEventVerifier({ secret: SECRET, header: 'X-OpenRouter-Token' });
    // express lower-cases incoming header names
    const result = verifier(makeRequest({ 'x-openrouter-token': `Bearer ${SECRET}` }));
    expect(result.valid).toBe(true);
  });

  it('accepts a raw token when scheme stripping is disabled', () => {
    const verifier = openRouterWebhookEventVerifier({ secret: SECRET, scheme: null });
    const result = verifier(makeRequest({ authorization: SECRET }));
    expect(result.valid).toBe(true);
  });

  it('rejects a raw token (no scheme) when a scheme prefix is expected and the value lacks it but differs from the secret', () => {
    const verifier = openRouterWebhookEventVerifier({ secret: SECRET });
    // value has no "Bearer " prefix, so the whole value is compared and does not equal the secret
    const result = verifier(makeRequest({ authorization: `${SECRET}-extra` }));
    expect(result.valid).toBe(false);
  });

  it('reads the first value of an array-valued header', () => {
    const verifier = openRouterWebhookEventVerifier({ secret: SECRET });
    const result = verifier(makeRequest({ authorization: [`Bearer ${SECRET}`, 'Bearer other'] }));
    expect(result.valid).toBe(true);
  });
});
