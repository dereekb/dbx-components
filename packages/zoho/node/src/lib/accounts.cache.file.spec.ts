import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type ZohoAccessToken, ZohoAccountsAccessTokenCacheService } from '@dereekb/zoho';
import { fileZohoAccountsAccessTokenCacheService } from './accounts.cache.file';

function token(accessToken: string): ZohoAccessToken {
  return { accessToken, apiDomain: 'https://www.zohoapis.com', scope: 'ZohoRecruit.modules.ALL', expiresIn: 3600, expiresAt: new Date(Date.now() + 3600 * 1000) };
}

describe('fileZohoAccountsAccessTokenCacheService()', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'zoho-node-token-cache-'));
    filePath = join(dir, 'tokens.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function readFile(): Record<string, unknown> {
    return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  }

  it('should write a token and read it back with expiresAt revived to a Date', async () => {
    const written = token('a');
    await fileZohoAccountsAccessTokenCacheService(filePath).loadZohoAccessTokenCache('recruit').updateCachedToken(written);

    // a fresh service reads the file, not the memory of the first
    const read = await fileZohoAccountsAccessTokenCacheService(filePath).loadZohoAccessTokenCache('recruit').loadCachedToken();

    expect(read?.accessToken).toBe('a');
    expect(read?.expiresAt).toBeInstanceOf(Date);
    expect(read?.expiresAt.getTime()).toBe(written.expiresAt.getTime());
  });

  it('should read the disk on every load without the memory cache', async () => {
    const service = fileZohoAccountsAccessTokenCacheService(filePath, false);
    const cache = service.loadZohoAccessTokenCache('recruit');

    await cache.updateCachedToken(token('a'));
    writeFileSync(filePath, JSON.stringify({ recruit: { ...token('b'), expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() } }));

    expect((await cache.loadCachedToken())?.accessToken).toBe('b');
  });

  it('should clear only its own key', async () => {
    const service = fileZohoAccountsAccessTokenCacheService(filePath);

    await service.loadZohoAccessTokenCache('recruit').updateCachedToken(token('recruit'));
    await service.loadZohoAccessTokenCache('crm').updateCachedToken(token('crm'));
    await service.loadZohoAccessTokenCache('recruit').clearCachedToken();

    const file = readFile();
    expect(file['recruit']).toBeUndefined();
    expect(file['crm']).toBeDefined();
  });

  it('should read, rewrite and delete the token file', async () => {
    const service = fileZohoAccountsAccessTokenCacheService(filePath);

    expect(await service.readTokenFile()).toBeUndefined();

    await service.writeTokenFile({ recruit: token('recruit'), crm: undefined });
    const read = await service.readTokenFile();

    expect(read?.['recruit']?.accessToken).toBe('recruit');
    expect(read?.['recruit']?.expiresAt).toBeInstanceOf(Date);
    expect(read?.['crm']).toBeUndefined();
    expect((await service.loadZohoAccessTokenCache('recruit').loadCachedToken())?.accessToken).toBe('recruit');

    await service.deleteTokenFile();

    expect(await service.loadZohoAccessTokenCache('recruit').loadCachedToken()).toBeUndefined();
    expect(existsSync(filePath) ? readFile()['recruit'] : undefined).toBeUndefined();
  });

  it('should swallow a failing write', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // a directory where the file should be makes every write fail
    const service = fileZohoAccountsAccessTokenCacheService(dir, false);

    await expect(service.loadZohoAccessTokenCache('recruit').updateCachedToken(token('a'))).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should satisfy the ZohoAccountsAccessTokenCacheService contract', () => {
    const service: ZohoAccountsAccessTokenCacheService = fileZohoAccountsAccessTokenCacheService(filePath);
    expect(typeof service.loadZohoAccessTokenCache).toBe('function');
    expect(typeof ZohoAccountsAccessTokenCacheService).toBe('function');
  });
});
