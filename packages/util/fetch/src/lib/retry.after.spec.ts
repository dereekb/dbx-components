import { FetchResponseError } from './error';
import { parseRetryAfterHeader, readFetchErrorRetryAfter } from './retry.after';

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

describe('readFetchErrorRetryAfter()', () => {
  const now = new Date('2026-11-13T12:00:00Z');

  it('reads Retry-After off error.headers (a Headers)', () => {
    expect(readFetchErrorRetryAfter({ headers: new Headers({ 'retry-after': '2' }) })).toBe(2000);
  });

  it('reads Retry-After off error.response.headers (a FetchResponseError)', () => {
    const error = new FetchResponseError(new Response(null, { status: 429, headers: { 'Retry-After': '3' } }));
    expect(readFetchErrorRetryAfter(error)).toBe(3000);
  });

  it('reads a plain record case-insensitively', () => {
    expect(readFetchErrorRetryAfter({ headers: { 'Retry-After': '4' } })).toBe(4000);
  });

  it('reads an HTTP-date relative to now', () => {
    expect(readFetchErrorRetryAfter({ headers: { 'retry-after': 'Fri, 13 Nov 2026 12:00:30 GMT' } }, now)).toBe(30000);
  });

  it('prefers retry-after-ms over Retry-After', () => {
    expect(readFetchErrorRetryAfter({ headers: new Headers({ 'retry-after': '1', 'retry-after-ms': '1500' }) })).toBe(1500);
    expect(readFetchErrorRetryAfter({ headers: { 'Retry-After-Ms': '250.5' } })).toBe(250.5);
  });

  it('falls back to Retry-After when retry-after-ms is unreadable', () => {
    expect(readFetchErrorRetryAfter({ headers: { 'retry-after-ms': '-5', 'retry-after': '2' } })).toBe(2000);
    expect(readFetchErrorRetryAfter({ headers: { 'retry-after-ms': 'abc', 'retry-after': '2' } })).toBe(2000);
  });

  it('returns undefined for a negative, NaN or blank value', () => {
    expect(readFetchErrorRetryAfter({ headers: { 'retry-after-ms': '-5' } })).toBeUndefined();
    expect(readFetchErrorRetryAfter({ headers: { 'retry-after-ms': 'NaN' } })).toBeUndefined();
    expect(readFetchErrorRetryAfter({ headers: { 'retry-after': '   ' } })).toBeUndefined();
    expect(readFetchErrorRetryAfter({ headers: new Headers() })).toBeUndefined();
  });

  it('returns undefined for a non-object or an error without headers', () => {
    expect(readFetchErrorRetryAfter(undefined)).toBeUndefined();
    expect(readFetchErrorRetryAfter(null)).toBeUndefined();
    expect(readFetchErrorRetryAfter('429')).toBeUndefined();
    expect(readFetchErrorRetryAfter(429)).toBeUndefined();
    expect(readFetchErrorRetryAfter(new Error('boom'))).toBeUndefined();
    expect(readFetchErrorRetryAfter({ headers: 'retry-after: 2' })).toBeUndefined();
  });
});
