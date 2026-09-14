import { describe, expect, it } from 'vitest';
import { FIRESTORE_SESSION_MAX_CACHE_MS, type FirestoreSessionCacheEntry, firestoreSessionEntryExpiresAt, isFirestoreSessionExpired } from './firestore-session.cache';

const NOW = Date.parse('2026-08-19T12:00:00.000Z');

function entry(input: { readonly cachedAt: number; readonly expiresAt: string }): FirestoreSessionCacheEntry {
  return {
    cachedAt: input.cachedAt,
    uid: 'uid-1',
    session: { uid: 'uid-1', customToken: 'ct', expiresAt: input.expiresAt }
  };
}

describe('firestoreSessionEntryExpiresAt()', () => {
  it('uses the API-reported expiry when it lands inside the one-hour ceiling', () => {
    const reported = NOW + 15 * 60 * 1000;
    const result = firestoreSessionEntryExpiresAt(entry({ cachedAt: NOW, expiresAt: new Date(reported).toISOString() }));
    expect(result).toBe(reported);
  });

  it('clamps an over-long API-reported expiry to the one-hour ceiling', () => {
    const reported = NOW + 24 * 60 * 60 * 1000;
    const result = firestoreSessionEntryExpiresAt(entry({ cachedAt: NOW, expiresAt: new Date(reported).toISOString() }));
    expect(result).toBe(NOW + FIRESTORE_SESSION_MAX_CACHE_MS);
  });

  it('falls back to the one-hour ceiling when the API-reported expiry is unparsable', () => {
    const result = firestoreSessionEntryExpiresAt(entry({ cachedAt: NOW, expiresAt: 'not-a-date' }));
    expect(result).toBe(NOW + FIRESTORE_SESSION_MAX_CACHE_MS);
  });
});

describe('isFirestoreSessionExpired()', () => {
  const hourLong = entry({ cachedAt: NOW, expiresAt: new Date(NOW + FIRESTORE_SESSION_MAX_CACHE_MS).toISOString() });

  it('treats a missing entry as expired', () => {
    expect(isFirestoreSessionExpired(undefined, NOW)).toBe(true);
  });

  it('reuses a freshly cached session', () => {
    expect(isFirestoreSessionExpired(hourLong, NOW + 60_000)).toBe(false);
  });

  it('reuses a session up to the buffer before the one-hour ceiling', () => {
    expect(isFirestoreSessionExpired(hourLong, NOW + FIRESTORE_SESSION_MAX_CACHE_MS - 120_000)).toBe(false);
  });

  it('expires a session inside the skew buffer of the ceiling', () => {
    expect(isFirestoreSessionExpired(hourLong, NOW + FIRESTORE_SESSION_MAX_CACHE_MS - 30_000)).toBe(true);
  });

  it('expires a session past the one-hour ceiling even when the API promised longer', () => {
    const overLong = entry({ cachedAt: NOW, expiresAt: new Date(NOW + 24 * 60 * 60 * 1000).toISOString() });
    expect(isFirestoreSessionExpired(overLong, NOW + FIRESTORE_SESSION_MAX_CACHE_MS + 1000)).toBe(true);
  });
});
