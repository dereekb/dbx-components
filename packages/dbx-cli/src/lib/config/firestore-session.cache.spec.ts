import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLI_FIRESTORE_SESSION_MAX_CACHE_MS, type CliFirestoreSessionEntry, cliFirestoreSessionEntryExpiresAt, createCliFirestoreSessionCacheStore, isCliFirestoreSessionExpired } from './firestore-session.cache';

const NOW = Date.parse('2026-08-19T12:00:00.000Z');

function entry(input: { readonly cachedAt: number; readonly expiresAt: string }): CliFirestoreSessionEntry {
  return {
    cachedAt: input.cachedAt,
    uid: 'uid-1',
    session: { uid: 'uid-1', customToken: 'ct', expiresAt: input.expiresAt }
  };
}

/**
 * The expiry policy itself is owned (and exhaustively specced) by
 * `@dereekb/oauth-resource/firebase`; these cases pin that the CLI's aliases still resolve to it, so
 * the one-hour Firebase credential ceiling cannot silently drift away from the CLI.
 */
describe('CLI session expiry aliases', () => {
  it('clamps an over-long API-reported expiry to the one-hour ceiling', () => {
    const reported = NOW + 24 * 60 * 60 * 1000;
    expect(cliFirestoreSessionEntryExpiresAt(entry({ cachedAt: NOW, expiresAt: new Date(reported).toISOString() }))).toBe(NOW + CLI_FIRESTORE_SESSION_MAX_CACHE_MS);
  });

  it('treats a missing entry as expired and a fresh one as usable', () => {
    const hourLong = entry({ cachedAt: NOW, expiresAt: new Date(NOW + CLI_FIRESTORE_SESSION_MAX_CACHE_MS).toISOString() });

    expect(isCliFirestoreSessionExpired(undefined, NOW)).toBe(true);
    expect(isCliFirestoreSessionExpired(hourLong, NOW + 60_000)).toBe(false);
    expect(isCliFirestoreSessionExpired(hourLong, NOW + CLI_FIRESTORE_SESSION_MAX_CACHE_MS - 30_000)).toBe(true);
  });
});

describe('createCliFirestoreSessionCacheStore()', () => {
  it('round-trips an entry through a 0600 JSON file', async () => {
    // the file-backed half is what STAYS in dbx-cli (it needs `@dereekb/nestjs`), and the 0600 mode is
    // load-bearing: each entry holds a custom token, a bearer credential for its user
    const dir = mkdtempSync(join(tmpdir(), 'dbx-cli-session-cache-'));
    const filePath = join(dir, '.firestore-sessions.json');
    const store = createCliFirestoreSessionCacheStore({ firestoreSessionCachePath: filePath });
    const written = entry({ cachedAt: NOW, expiresAt: new Date(NOW + 60_000).toISOString() });

    await store.set('prod', written);

    expect(await store.get('prod')).toEqual(written);
    expect(statSync(filePath).mode & 0o777).toBe(0o600);
    // the on-disk shape is the `session` key every existing `~/.<cli>/.firestore-sessions.json` uses
    expect(JSON.parse(readFileSync(filePath, 'utf8')).prod.session.customToken).toBe('ct');

    await store.remove('prod');
    expect(await store.get('prod')).toBeUndefined();
  });
});
