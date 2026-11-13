import { parseRetryAfterHeader } from './retry.after';

describe('parseRetryAfterHeader()', () => {
  const now = new Date('2026-11-13T12:00:00Z');

  it('parses delay-seconds', () => {
    expect(parseRetryAfterHeader('120')).toBe(120000);
    expect(parseRetryAfterHeader(' 0 ')).toBe(0);
  });

  it('parses an HTTP-date relative to now', () => {
    expect(parseRetryAfterHeader('Fri, 13 Nov 2026 12:00:30 GMT', now)).toBe(30000);
  });

  it('returns 0 for a date in the past', () => {
    expect(parseRetryAfterHeader('Fri, 13 Nov 2026 11:59:00 GMT', now)).toBe(0);
  });

  it('returns undefined when absent or unparseable', () => {
    expect(parseRetryAfterHeader(undefined)).toBeUndefined();
    expect(parseRetryAfterHeader(null)).toBeUndefined();
    expect(parseRetryAfterHeader('')).toBeUndefined();
    expect(parseRetryAfterHeader('abc')).toBeUndefined();
    expect(parseRetryAfterHeader('-5')).toBeUndefined();
    expect(parseRetryAfterHeader('1.5')).toBeUndefined();
  });
});
