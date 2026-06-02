import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCliTokenCacheStore, isTokenExpired, type CliTokenEntry } from './token.cache';

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

describe('createCliTokenCacheStore', () => {
  let dir: string;
  let tokenCachePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbx-cli-token-cache-'));
    tokenCachePath = join(dir, '.tokens.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('roundtrips a CliTokenEntry through set/get', async () => {
    const tokens = createCliTokenCacheStore({ tokenCachePath });
    const entry: CliTokenEntry = { accessToken: 'a', expiresAt: Date.now() + 60_000, refreshToken: 'r' };

    await tokens.set('dev', entry);
    expect(await tokens.get('dev')).toEqual(entry);
  });

  it('roundtrips the session lifetime fields (sessionExpiresAt / rotationDisabled)', async () => {
    const tokens = createCliTokenCacheStore({ tokenCachePath });
    const entry: CliTokenEntry = { accessToken: 'a', expiresAt: Date.now() + 60_000, refreshToken: 'r', scope: 'openid demo token.service', sessionExpiresAt: 1_900_000_000, rotationDisabled: true };

    await tokens.set('dev', entry);
    const result = await tokens.get('dev');
    expect(result?.sessionExpiresAt).toBe(1_900_000_000);
    expect(result?.rotationDisabled).toBe(true);
  });

  it('persists to disk so a fresh store reads the same value', async () => {
    const writer = createCliTokenCacheStore({ tokenCachePath });
    const entry: CliTokenEntry = { accessToken: 'a', expiresAt: Date.now() + 60_000 };
    await writer.set('dev', entry);

    const reader = createCliTokenCacheStore({ tokenCachePath });
    expect(await reader.get('dev')).toEqual(entry);
  });

  it('remove() drops only the requested env', async () => {
    const tokens = createCliTokenCacheStore({ tokenCachePath });
    await tokens.set('dev', { accessToken: 'a', expiresAt: 1 });
    await tokens.set('prod', { accessToken: 'b', expiresAt: 2 });

    await tokens.remove('dev');
    expect(await tokens.get('dev')).toBeUndefined();
    expect(await tokens.get('prod')).toEqual({ accessToken: 'b', expiresAt: 2 });
  });
});
