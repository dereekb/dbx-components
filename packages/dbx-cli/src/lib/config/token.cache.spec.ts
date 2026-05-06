import { describe, it, expect } from 'vitest';
import { isTokenExpired } from './token.cache';

describe('isTokenExpired', () => {
  it('returns true when entry is undefined', () => {
    expect(isTokenExpired(undefined)).toBe(true);
  });

  it('returns true when expiresAt is past now (after buffer)', () => {
    const now = 1_000_000;
    const entry = { accessToken: 'a', expiresAt: now - 1 };
    expect(isTokenExpired(entry, now, 0)).toBe(true);
  });

  it('returns false when expiresAt is in the future beyond the buffer', () => {
    const now = 1_000_000;
    const entry = { accessToken: 'a', expiresAt: now + 120_000 };
    expect(isTokenExpired(entry, now, 60_000)).toBe(false);
  });

  it('returns true when expiresAt is within the buffer window', () => {
    const now = 1_000_000;
    const entry = { accessToken: 'a', expiresAt: now + 30_000 };
    expect(isTokenExpired(entry, now, 60_000)).toBe(true);
  });
});
