import { describe, expect, it } from 'vitest';
import { CLI_FIRESTORE_SESSION_MAX_CACHE_MS, type CliFirestoreSessionEntry, cliFirestoreSessionEntryExpiresAt, isCliFirestoreSessionExpired } from './firestore-session.cache';

const NOW = Date.parse('2026-08-19T12:00:00.000Z');

function entry(input: { readonly cachedAt: number; readonly expiresAt: string }): CliFirestoreSessionEntry {
  return {
    cachedAt: input.cachedAt,
    uid: 'uid-1',
    session: { uid: 'uid-1', customToken: 'ct', expiresAt: input.expiresAt }
  };
}

describe('cliFirestoreSessionEntryExpiresAt()', () => {
  it('uses the API-reported expiry when it lands inside the one-hour ceiling', () => {
    const reported = NOW + 15 * 60 * 1000;
    const result = cliFirestoreSessionEntryExpiresAt(entry({ cachedAt: NOW, expiresAt: new Date(reported).toISOString() }));
    expect(result).toBe(reported);
  });

  it('clamps an over-long API-reported expiry to the one-hour ceiling', () => {
    const reported = NOW + 24 * 60 * 60 * 1000;
    const result = cliFirestoreSessionEntryExpiresAt(entry({ cachedAt: NOW, expiresAt: new Date(reported).toISOString() }));
    expect(result).toBe(NOW + CLI_FIRESTORE_SESSION_MAX_CACHE_MS);
  });

  it('falls back to the one-hour ceiling when the API-reported expiry is unparsable', () => {
    const result = cliFirestoreSessionEntryExpiresAt(entry({ cachedAt: NOW, expiresAt: 'not-a-date' }));
    expect(result).toBe(NOW + CLI_FIRESTORE_SESSION_MAX_CACHE_MS);
  });
});

describe('isCliFirestoreSessionExpired()', () => {
  const hourLong = entry({ cachedAt: NOW, expiresAt: new Date(NOW + CLI_FIRESTORE_SESSION_MAX_CACHE_MS).toISOString() });

  it('treats a missing entry as expired', () => {
    expect(isCliFirestoreSessionExpired(undefined, NOW)).toBe(true);
  });

  it('reuses a freshly cached session', () => {
    expect(isCliFirestoreSessionExpired(hourLong, NOW + 60_000)).toBe(false);
  });

  it('reuses a session up to the buffer before the one-hour ceiling', () => {
    expect(isCliFirestoreSessionExpired(hourLong, NOW + CLI_FIRESTORE_SESSION_MAX_CACHE_MS - 120_000)).toBe(false);
  });

  it('expires a session inside the skew buffer of the ceiling', () => {
    expect(isCliFirestoreSessionExpired(hourLong, NOW + CLI_FIRESTORE_SESSION_MAX_CACHE_MS - 30_000)).toBe(true);
  });

  it('expires a session past the one-hour ceiling even when the API promised longer', () => {
    const overLong = entry({ cachedAt: NOW, expiresAt: new Date(NOW + 24 * 60 * 60 * 1000).toISOString() });
    expect(isCliFirestoreSessionExpired(overLong, NOW + CLI_FIRESTORE_SESSION_MAX_CACHE_MS + 1000)).toBe(true);
  });
});
