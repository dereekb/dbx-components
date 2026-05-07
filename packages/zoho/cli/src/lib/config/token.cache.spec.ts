import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type ZohoAccessToken } from '@dereekb/zoho';
import { createFileTokenCache } from './token.cache';

describe('createFileTokenCache', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'zoho-cli-token-cache-'));
    filePath = join(dir, '.tokens.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns undefined when no token has been cached', async () => {
    const cache = createFileTokenCache(filePath);
    expect(await cache.loadCachedToken()).toBeUndefined();
  });

  it('roundtrips a ZohoAccessToken with Date-typed expiresAt', async () => {
    const writer = createFileTokenCache(filePath);
    const token: ZohoAccessToken = {
      accessToken: 'a',
      scope: 'ZohoRecruit.modules.ALL',
      apiDomain: 'https://www.zohoapis.com',
      expiresIn: 3600,
      expiresAt: new Date('2030-01-01T00:00:00.000Z')
    };

    await writer.updateCachedToken(token);

    const reader = createFileTokenCache(filePath);
    const loaded = await reader.loadCachedToken();
    expect(loaded?.expiresAt).toBeInstanceOf(Date);
    expect(loaded?.expiresAt.getTime()).toBe(token.expiresAt.getTime());
    expect(loaded?.accessToken).toBe(token.accessToken);
    expect(loaded?.scope).toBe(token.scope);
    expect(loaded?.apiDomain).toBe(token.apiDomain);
    expect(loaded?.expiresIn).toBe(token.expiresIn);
  });

  it('clearCachedToken deletes the file', async () => {
    const cache = createFileTokenCache(filePath);
    await cache.updateCachedToken({
      accessToken: 'a',
      scope: 's',
      apiDomain: 'd',
      expiresIn: 1,
      expiresAt: new Date()
    });

    await cache.clearCachedToken();
    expect(() => statSync(filePath)).toThrow();
    expect(await cache.loadCachedToken()).toBeUndefined();
  });
});
