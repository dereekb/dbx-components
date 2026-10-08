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
import { buildAuthShowResult, buildAuthTokenSourceShowResult, clearAuthTokenSource, setAuthTokenSource } from './auth.command';
import { getConfigFilePath, getTokenCachePath, loadCliConfig, loadCliConfigFile, mergeCliConfig, ZOHO_CLI_TOKEN_COMMAND_ENV_VAR, type ZohoCliConfig } from '../config/cli.config';
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

      const result = await setAuthTokenSource('  demo-cli external-token zoho_admin  ');
      const after = readConfigFile();

      expect(result).toEqual({ saved: true, command: 'demo-cli external-token zoho_admin' });
      expect(after['tokenSource']).toEqual({ command: 'demo-cli external-token zoho_admin' });
      expect({ ...after, tokenSource: undefined }).toEqual({ ...before, tokenSource: undefined });
    });

    it('should not create a shared block when no config file exists', async () => {
      await setAuthTokenSource('demo-cli external-token zoho_admin');

      expect(readConfigFile()).toEqual({ tokenSource: { command: 'demo-cli external-token zoho_admin' } });
      expect((await loadCliConfig())?.tokenSource?.command).toBe('demo-cli external-token zoho_admin');
    });

    it('should reject a blank command', async () => {
      await expect(setAuthTokenSource('   ')).rejects.toThrow('cannot be empty');
    });

    it("should evict a replaced command's cached token and keep the other token file entries", async () => {
      await setAuthTokenSource('old-cmd');
      writeTokenFile({ crm: { accessToken: 'crm-token' }, [zohoCliTokenSourceCacheKey('old-cmd')]: cachedToken('old') });

      await setAuthTokenSource('new-cmd');
      const tokens = readTokenFile();

      expect(tokens[zohoCliTokenSourceCacheKey('old-cmd')]).toBeUndefined();
      expect(tokens['crm']).toEqual({ accessToken: 'crm-token' });
    });

    it('should report an env override that wins over the saved command', async () => {
      process.env[ZOHO_CLI_TOKEN_COMMAND_ENV_VAR] = 'env-cmd';
      expect((await setAuthTokenSource('saved-cmd')).envOverride).toBe('env-cmd');
    });

    it('should survive a later credential write', async () => {
      await setAuthTokenSource('saved-cmd');
      await mergeCliConfig({ shared: { ...creds } });

      expect((await loadCliConfigFile())?.tokenSource?.command).toBe('saved-cmd');
    });
  });

  describe('clearAuthTokenSource()', () => {
    it('should remove only the token source block and its cached token', async () => {
      await mergeCliConfig({ shared: { ...creds }, sign: { ...creds, apiUrl: 'production' } });
      const before = readConfigFile();
      await setAuthTokenSource('saved-cmd');
      writeTokenFile({ sign: { accessToken: 'sign-token' }, [zohoCliTokenSourceCacheKey('saved-cmd')]: cachedToken('minted') });

      const result = await clearAuthTokenSource();

      expect(result).toEqual({ cleared: true, command: 'saved-cmd' });
      expect(readConfigFile()).toEqual(before);
      expect(readTokenFile()).toEqual({ sign: { accessToken: 'sign-token' } });
    });

    it('should report nothing cleared when no command is saved', async () => {
      expect(await clearAuthTokenSource()).toEqual({ cleared: false });
    });
  });

  describe('buildAuthTokenSourceShowResult()', () => {
    it('should report the saved command and the env override, with the override active', async () => {
      await setAuthTokenSource('saved-cmd');
      process.env[ZOHO_CLI_TOKEN_COMMAND_ENV_VAR] = 'env-cmd';

      const result = await buildAuthTokenSourceShowResult();

      expect(result.saved).toBe('saved-cmd');
      expect(result.envOverride).toBe('env-cmd');
      expect(result.active).toEqual({ command: 'env-cmd', origin: 'env' });
      expect(result.cached).toBeNull();
    });

    it("should describe the active source's cached token without the token", async () => {
      await setAuthTokenSource('saved-cmd');
      writeTokenFile({ [zohoCliTokenSourceCacheKey('saved-cmd')]: cachedToken('minted-secret') });

      const result = await buildAuthTokenSourceShowResult();

      expect(result.cached).toMatchObject({ products: ['crm'], datacenter: 'eu', scopes: ['ZohoCRM.modules.ALL'] });
      expect(JSON.stringify(result)).not.toContain('minted-secret');
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
