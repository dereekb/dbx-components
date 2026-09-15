import { describe, expect, it } from 'vitest';
import { clientIpsMatch, normalizeClientIp, requestClientIp } from './request.ip';

describe('requestClientIp()', () => {
  it('prefers the leftmost x-forwarded-for entry', () => {
    const result = requestClientIp({ headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' }, ip: '10.0.0.1' });
    expect(result).toBe('203.0.113.7');
  });

  it('reads an array-valued x-forwarded-for header', () => {
    const result = requestClientIp({ headers: { 'x-forwarded-for': ['203.0.113.7', '198.51.100.9'] } });
    expect(result).toBe('203.0.113.7');
  });

  it('falls back to req.ip when no forwarding header is present', () => {
    expect(requestClientIp({ ip: '198.51.100.9' })).toBe('198.51.100.9');
  });

  it('falls back to the raw socket address last', () => {
    expect(requestClientIp({ socket: { remoteAddress: '198.51.100.9' } })).toBe('198.51.100.9');
  });

  // A dual-stack listener reports a v4 caller as ::ffff:a.b.c.d, so the same caller would otherwise
  // compare unequal to itself across two listeners.
  it('normalizes an IPv4-mapped IPv6 address', () => {
    expect(requestClientIp({ ip: '::ffff:127.0.0.1' })).toBe('127.0.0.1');
  });

  it('skips an empty forwarding header rather than returning an empty string', () => {
    expect(requestClientIp({ headers: { 'x-forwarded-for': '   ' }, ip: '198.51.100.9' })).toBe('198.51.100.9');
  });

  it('returns undefined when nothing resolves', () => {
    expect(requestClientIp({})).toBeUndefined();
    expect(requestClientIp(undefined)).toBeUndefined();
  });
});

describe('normalizeClientIp()', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeClientIp('  203.0.113.7 ')).toBe('203.0.113.7');
  });

  it('leaves a real IPv6 address alone', () => {
    expect(normalizeClientIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it('returns undefined for an absent or blank value', () => {
    expect(normalizeClientIp(undefined)).toBeUndefined();
    expect(normalizeClientIp('')).toBeUndefined();
    expect(normalizeClientIp('  ')).toBeUndefined();
  });
});

describe('clientIpsMatch()', () => {
  it('matches equal addresses', () => {
    expect(clientIpsMatch('203.0.113.7', '203.0.113.7')).toBe(true);
  });

  it('matches across the IPv4-mapped form', () => {
    expect(clientIpsMatch('::ffff:127.0.0.1', '127.0.0.1')).toBe(true);
  });

  it('does not match different addresses', () => {
    expect(clientIpsMatch('203.0.113.7', '198.51.100.9')).toBe(false);
  });

  // A binding that passed when the address could not be resolved would be no binding at all.
  it('treats an absent address on either side as a mismatch', () => {
    expect(clientIpsMatch(undefined, '203.0.113.7')).toBe(false);
    expect(clientIpsMatch('203.0.113.7', undefined)).toBe(false);
    expect(clientIpsMatch(undefined, undefined)).toBe(false);
  });
});
