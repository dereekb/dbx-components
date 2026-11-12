import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as NodeOs from 'node:os';

/**
 * Home directory the CLI config functions are pointed at for this file (see `cli.config.merge.spec.ts`).
 */
const testHome = vi.hoisted(() => `${process.env['TMPDIR']?.replace(/\/$/, '') ?? '/tmp'}/zoho-cli-auth-token-source-spec-${process.pid}`);

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>();
  return { ...actual, homedir: () => testHome };
});

import { MS_IN_HOUR } from '@dereekb/util';
import { buildAuthShowResult, buildAuthTokenSourceShowResult, clearAuthTokenSource, setAuthTokenSource, useAuthTokenSource } from './auth.command';
import { getConfigFilePath, getTokenCachePath, loadCliConfig, loadCliConfigFile, mergeCliConfig, ZOHO_CLI_TOKEN_COMMAND_ENV_VAR, ZOHO_CLI_TOKEN_SOURCE_ENV_VAR, type ZohoCliConfig } from '../config/cli.config';
import { zohoCliTokenSourceCacheKey, type ZohoCliTokenSourceStatus } from '../config/token.source';

const creds = {
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'token'
};

function readConfigFile(): Record<string, unknown> {
  return JSON.parse(readFileSync(getConfigFilePath(), 'utf8')) as Record<string, unknown>;
}

function writeTokenFile(entries: Record<string, unknown>): void {
  mkdirSync(join(testHome, '.zoho-cli'), { recursive: true });
  writeFileSync(getTokenCachePath(), JSON.stringify(entries));
}

function readTokenFile(): Record<string, unknown> {
  return JSON.parse(readFileSync(getTokenCachePath(), 'utf8')) as Record<string, unknown>;
}

function cachedToken(accessToken: string) {
  return { accessToken, scopes: ['ZohoCRM.modules.ALL'], expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString(), location: 'eu' };
}

describe('auth token-source', () => {
  let clearedEnv: [string, string][] = [];

  beforeEach(() => {
    rmSync(testHome, { recursive: true, force: true });

    clearedEnv = Object.entries(process.env).filter(([key, value]) => key.startsWith('ZOHO_') && value != null) as [string, string][];
    clearedEnv.forEach(([key]) => delete process.env[key]);
  });

  afterEach(() => {
    Object.keys(process.env)
      .filter((key) => key.startsWith('ZOHO_'))
      .forEach((key) => delete process.env[key]);

    clearedEnv.forEach(([key, value]) => {
      process.env[key] = value;
    });

    rmSync(testHome, { recursive: true, force: true });
  });

  it('should write inside the temporary home rather than the real one', () => {
    expect(getConfigFilePath().startsWith(testHome)).toBe(true);
  });

  // the generic set/use/show/clear behaviour is covered by dbx-cli's token-source spec; these cover the
  // zoho-cli config file (credential blocks), apiMode, and the cached token's coverage
  describe('setAuthTokenSource()', () => {
    it('should save the command without touching the shared or product blocks', async () => {
      await mergeCliConfig({ shared: { ...creds, region: 'eu' }, crm: { clientId: 'crm-id', clientSecret: 'crm-secret', refreshToken: 'crm-token' }, desk: { orgId: '42' }, output: { pick: 'id' } });
      const before = readConfigFile();

      const result = await setAuthTokenSource({ command: '  demo-cli external-token zoho_admin  ' });
      const after = readConfigFile();

      expect(result).toEqual({ saved: true, name: 'default', command: 'demo-cli external-token zoho_admin', apiMode: 'production' });
      expect(after['tokenSource']).toEqual({ command: 'demo-cli external-token zoho_admin' });
      expect({ ...after, tokenSource: undefined }).toEqual({ ...before, tokenSource: undefined });
    });

    it('should not create a shared block when no config file exists', async () => {
      await setAuthTokenSource({ command: 'demo-cli external-token zoho_admin' });

      expect(readConfigFile()).toEqual({ tokenSource: { command: 'demo-cli external-token zoho_admin' } });
      expect((await loadCliConfig())?.tokenSource?.command).toBe('demo-cli external-token zoho_admin');
    });

    it("should evict a replaced command's cached token and keep the product tokens", async () => {
      await setAuthTokenSource({ command: 'old-cmd' });
      writeTokenFile({ crm: { accessToken: 'crm-token' }, [zohoCliTokenSourceCacheKey('old-cmd')]: cachedToken('old') });

      await setAuthTokenSource({ command: 'new-cmd' });
      const tokens = readTokenFile();

      expect(tokens[zohoCliTokenSourceCacheKey('old-cmd')]).toBeUndefined();
      expect(tokens['crm']).toEqual({ accessToken: 'crm-token' });
    });

    it('should report the ZOHO_CLI_TOKEN_COMMAND override that wins over the saved command', async () => {
      process.env[ZOHO_CLI_TOKEN_COMMAND_ENV_VAR] = 'env-cmd';
      expect((await setAuthTokenSource({ command: 'saved-cmd' })).envOverride).toBe('env-cmd');
    });

    it('should survive a later credential write', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      await mergeCliConfig({ shared: { ...creds } });

      expect((await loadCliConfigFile())?.tokenSource?.command).toBe('saved-cmd');
    });

    it('should save a named source next to the unnamed one, storing only a sandbox api mode', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      const dev = await setAuthTokenSource({ command: 'dev-cmd', name: 'dev', apiMode: 'sandbox' });
      await setAuthTokenSource({ command: 'prod-cmd', name: 'prod', apiMode: 'production' });

      expect(dev).toEqual({ saved: true, name: 'dev', command: 'dev-cmd', apiMode: 'sandbox' });
      expect(readConfigFile()).toEqual({ tokenSource: { command: 'saved-cmd' }, tokenSources: { dev: { command: 'dev-cmd', apiMode: 'sandbox' }, prod: { command: 'prod-cmd' } } });
    });

    it('should keep the stored api mode when a source is saved again without one', async () => {
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev', apiMode: 'sandbox' });
      const result = await setAuthTokenSource({ command: 'dev-cmd-2', name: 'dev' });

      expect(result.apiMode).toBe('sandbox');
      expect((await loadCliConfigFile())?.tokenSources?.['dev']).toEqual({ command: 'dev-cmd-2', apiMode: 'sandbox' });
    });
  });

  describe('useAuthTokenSource()', () => {
    it('should select a saved source with its api mode, and the unnamed one again with use default', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev', apiMode: 'sandbox' });

      expect(await useAuthTokenSource('dev')).toEqual({ activeTokenSource: 'dev', command: 'dev-cmd', apiMode: 'sandbox' });
      expect((await loadCliConfig())?.tokenSource).toEqual({ command: 'dev-cmd', apiMode: 'sandbox' });

      await useAuthTokenSource('default');
      expect((await loadCliConfigFile())?.activeTokenSource).toBeUndefined();
      expect((await loadCliConfig())?.tokenSource).toEqual({ command: 'saved-cmd' });
    });

    it('should name zoho-cli in the hint for a name with no saved source', async () => {
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev' });
      await expect(useAuthTokenSource('prod')).rejects.toMatchObject({ message: 'No token source is saved as "prod". Saved token sources: dev.', code: 'TOKEN_SOURCE_UNKNOWN', suggestion: 'Save it with: zoho-cli auth token-source set "<command>" --name prod' });
    });
  });

  describe('clearAuthTokenSource()', () => {
    it('should remove only the token source block and its cached token', async () => {
      await mergeCliConfig({ shared: { ...creds }, sign: { ...creds, apiUrl: 'production' } });
      const before = readConfigFile();
      await setAuthTokenSource({ command: 'saved-cmd' });
      writeTokenFile({ sign: { accessToken: 'sign-token' }, [zohoCliTokenSourceCacheKey('saved-cmd')]: cachedToken('minted') });

      const result = await clearAuthTokenSource();

      expect(result).toEqual({ cleared: true, name: 'default', command: 'saved-cmd' });
      expect(readConfigFile()).toEqual(before);
      expect(readTokenFile()).toEqual({ sign: { accessToken: 'sign-token' } });
    });
  });

  describe('buildAuthTokenSourceShowResult()', () => {
    it("should describe the active source's cached token by its coverage, without the token", async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      writeTokenFile({ [zohoCliTokenSourceCacheKey('saved-cmd')]: cachedToken('minted-secret') });

      const result = await buildAuthTokenSourceShowResult();

      expect(result.cached).toEqual({ products: ['crm'], datacenter: 'eu', expiresAt: expect.any(String), scopes: ['ZohoCRM.modules.ALL'] });
      expect(JSON.stringify(result)).not.toContain('minted-secret');
    });

    it('should list every saved source with its api mode and mark the one in effect', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev', apiMode: 'sandbox' });
      await useAuthTokenSource('dev');

      const result = await buildAuthTokenSourceShowResult();

      expect(result.sources).toEqual([
        { name: 'default', command: 'saved-cmd', apiMode: 'production', active: false },
        { name: 'dev', command: 'dev-cmd', apiMode: 'sandbox', active: true }
      ]);
      expect(result.activeTokenSource).toBe('dev');
      expect(result.active).toEqual({ command: 'dev-cmd', apiMode: 'sandbox', origin: 'config', name: 'dev' });
    });

    it('should report a ZOHO_CLI_TOKEN_SOURCE name with no saved source as an error instead of failing', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      process.env[ZOHO_CLI_TOKEN_SOURCE_ENV_VAR] = 'staging';

      const result = await buildAuthTokenSourceShowResult();

      expect(result.active).toBeNull();
      expect(result.envSelection).toBe('staging');
      expect(result.error).toContain('Unknown token source "staging"');
      expect(result.suggestion).toBe('Save it with: zoho-cli auth token-source set "<command>" --name staging');
    });
  });

  describe('buildAuthShowResult()', () => {
    it('should report the token source and count its covered products as configured', () => {
      const config: ZohoCliConfig = { shared: { clientId: '', clientSecret: '', refreshToken: '' }, tokenSource: { command: 'saved-cmd' } };
      const status = {
        active: { command: 'saved-cmd', origin: 'config' },
        resolved: { products: ['crm'], datacenter: 'eu', hints: undefined, token: { accessToken: 'minted-secret', scopes: ['ZohoCRM.modules.ALL'], expiresAt: '2030-01-01T00:00:00.000Z' } }
      } as unknown as ZohoCliTokenSourceStatus;

      const result = buildAuthShowResult(config, undefined, status);

      expect(result['configuredProducts']).toEqual(['crm']);
      expect(result['tokenSource']).toMatchObject({ command: 'saved-cmd', origin: 'config', products: ['crm'], datacenter: 'eu', expiresAt: '2030-01-01T00:00:00.000Z' });
      expect(JSON.stringify(result)).not.toContain('minted-secret');
    });

    it("should carry a failing source's error code, server code and suggestion", () => {
      const config: ZohoCliConfig = { shared: { clientId: '', clientSecret: '', refreshToken: '' }, tokenSource: { command: 'saved-cmd' } };
      const status: ZohoCliTokenSourceStatus = {
        active: { command: 'saved-cmd', origin: 'config' },
        error: 'external-token zoho_admin failed: Forbidden',
        errorCode: 'AUTH_FORBIDDEN',
        serverCode: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR',
        suggestion: 'Re-mint the credential.'
      };

      const result = buildAuthShowResult(config, undefined, status);

      expect(result['configuredProducts']).toEqual([]);
      expect(result['tokenSource']).toMatchObject({ command: 'saved-cmd', origin: 'config', apiMode: 'production', error: 'external-token zoho_admin failed: Forbidden', errorCode: 'AUTH_FORBIDDEN', serverCode: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR', suggestion: 'Re-mint the credential.' });
    });
  });
});
