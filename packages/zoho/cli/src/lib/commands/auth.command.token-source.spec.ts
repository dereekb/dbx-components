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

    it('should reject a blank command', async () => {
      await expect(setAuthTokenSource({ command: '   ' })).rejects.toThrow('cannot be empty');
    });

    it("should evict a replaced command's cached token and keep the other token file entries", async () => {
      await setAuthTokenSource({ command: 'old-cmd' });
      writeTokenFile({ crm: { accessToken: 'crm-token' }, [zohoCliTokenSourceCacheKey('old-cmd')]: cachedToken('old') });

      await setAuthTokenSource({ command: 'new-cmd' });
      const tokens = readTokenFile();

      expect(tokens[zohoCliTokenSourceCacheKey('old-cmd')]).toBeUndefined();
      expect(tokens['crm']).toEqual({ accessToken: 'crm-token' });
    });

    it('should report an env override that wins over the saved command', async () => {
      process.env[ZOHO_CLI_TOKEN_COMMAND_ENV_VAR] = 'env-cmd';
      expect((await setAuthTokenSource({ command: 'saved-cmd' })).envOverride).toBe('env-cmd');
    });

    it('should survive a later credential write', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      await mergeCliConfig({ shared: { ...creds } });

      expect((await loadCliConfigFile())?.tokenSource?.command).toBe('saved-cmd');
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

    it('should report nothing cleared when no command is saved', async () => {
      expect(await clearAuthTokenSource()).toEqual({ cleared: false, name: 'default' });
    });
  });

  describe('buildAuthTokenSourceShowResult()', () => {
    it('should report the saved command and the env override, with the override active', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      process.env[ZOHO_CLI_TOKEN_COMMAND_ENV_VAR] = 'env-cmd';

      const result = await buildAuthTokenSourceShowResult();

      expect(result.saved).toBe('saved-cmd');
      expect(result.envOverride).toBe('env-cmd');
      expect(result.active).toEqual({ command: 'env-cmd', origin: 'env' });
      expect(result.cached).toBeNull();
    });

    it("should describe the active source's cached token without the token", async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      writeTokenFile({ [zohoCliTokenSourceCacheKey('saved-cmd')]: cachedToken('minted-secret') });

      const result = await buildAuthTokenSourceShowResult();

      expect(result.cached).toMatchObject({ products: ['crm'], datacenter: 'eu', scopes: ['ZohoCRM.modules.ALL'] });
      expect(JSON.stringify(result)).not.toContain('minted-secret');
    });
  });

  describe('named token sources', () => {
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

    it('should reject an invalid name', async () => {
      await expect(setAuthTokenSource({ command: 'dev-cmd', name: 'dev env' })).rejects.toThrow('Invalid token source name "dev env"');
    });

    it("should evict a replaced named source's cached token", async () => {
      await setAuthTokenSource({ command: 'old-dev-cmd', name: 'dev' });
      writeTokenFile({ [zohoCliTokenSourceCacheKey('old-dev-cmd')]: cachedToken('old') });

      await setAuthTokenSource({ command: 'new-dev-cmd', name: 'dev' });

      expect(readTokenFile()[zohoCliTokenSourceCacheKey('old-dev-cmd')]).toBeUndefined();
    });

    it('should select a saved source with use, and the unnamed one again with use default', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev', apiMode: 'sandbox' });

      expect(await useAuthTokenSource('dev')).toEqual({ activeTokenSource: 'dev', command: 'dev-cmd', apiMode: 'sandbox' });
      expect((await loadCliConfig())?.tokenSource).toEqual({ command: 'dev-cmd', apiMode: 'sandbox' });

      await useAuthTokenSource('default');
      expect((await loadCliConfigFile())?.activeTokenSource).toBeUndefined();
      expect((await loadCliConfig())?.tokenSource).toEqual({ command: 'saved-cmd' });
    });

    it('should refuse to use a name with no saved source', async () => {
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev' });
      await expect(useAuthTokenSource('prod')).rejects.toThrow('No token source is saved as "prod". Saved token sources: dev.');
    });

    it('should report the env selection that wins over the saved one', async () => {
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev' });
      process.env[ZOHO_CLI_TOKEN_SOURCE_ENV_VAR] = 'prod';

      expect((await useAuthTokenSource('dev')).envSelection).toBe('prod');
    });

    it('should clear a named source, its cached token, and the selection that named it', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev' });
      await useAuthTokenSource('dev');
      writeTokenFile({ [zohoCliTokenSourceCacheKey('dev-cmd')]: cachedToken('dev') });

      const result = await clearAuthTokenSource({ name: 'dev' });

      expect(result).toEqual({ cleared: true, name: 'dev', command: 'dev-cmd', activeTokenSourceCleared: true });
      expect(readConfigFile()).toEqual({ tokenSource: { command: 'saved-cmd' } });
      expect(readTokenFile()).toEqual({});
    });

    it('should keep the selection when clearing a different source', async () => {
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev' });
      await setAuthTokenSource({ command: 'prod-cmd', name: 'prod' });
      await useAuthTokenSource('prod');

      await clearAuthTokenSource({ name: 'dev' });

      expect(readConfigFile()).toEqual({ tokenSources: { prod: { command: 'prod-cmd' } }, activeTokenSource: 'prod' });
    });

    it('should list every saved source and mark the one in effect', async () => {
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

    it('should follow the --token-source flag', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      await setAuthTokenSource({ command: 'dev-cmd', name: 'dev' });

      expect((await buildAuthTokenSourceShowResult({ tokenSourceName: 'dev' })).active).toMatchObject({ name: 'dev', origin: 'flag' });
    });

    it('should report an unknown selection as an error instead of failing', async () => {
      await setAuthTokenSource({ command: 'saved-cmd' });
      process.env[ZOHO_CLI_TOKEN_SOURCE_ENV_VAR] = 'staging';

      const result = await buildAuthTokenSourceShowResult();

      expect(result.active).toBeNull();
      expect(result.envSelection).toBe('staging');
      expect(result.error).toContain('Unknown token source "staging"');
      expect(result.sources.map((x) => x.name)).toEqual(['default']);
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
  });
});
