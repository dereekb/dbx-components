import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type * as NodeOs from 'node:os';

/**
 * Home directory the CLI config functions are pointed at for this file.
 *
 * Hoisted alongside the `node:os` mock, which vitest lifts above the imports — so the path cannot
 * come from a normal module-scope const.
 */
const testHome = vi.hoisted(() => `${process.env['TMPDIR']?.replace(/\/$/, '') ?? '/tmp'}/zoho-cli-auth-login-spec-${process.pid}`);

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>();
  return { ...actual, homedir: () => testHome };
});

import { ZOHO_ACCOUNTS_PROFILE_READ_SCOPE } from '@dereekb/zoho';
import { getConfigFilePath, loadCliConfigFile, mergeCliConfig, type ZohoCliConfig } from '../config/cli.config';
import { DEFAULT_AUTH_LOGIN_REDIRECT_URI, ZOHO_CLI_PRODUCT_SCOPES } from '../config/cli.oauth';
import { buildAuthLoginContext, saveAuthLoginResult, type AuthLoginResult } from './auth.command';

const creds = {
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'token'
};

describe('buildAuthLoginContext()', () => {
  const config: ZohoCliConfig = {
    shared: { clientId: 'shared-id', clientSecret: 'shared-secret', refreshToken: 'shared-token', region: 'eu', redirectUri: 'http://localhost:9000/callback' },
    crm: { orgId: undefined },
    sign: { clientId: 'sign-id', clientSecret: 'sign-secret', refreshToken: '', redirectUri: 'http://localhost:9100/callback', region: 'in' }
  };

  it('should prefer the flags over the stored client', () => {
    const ctx = buildAuthLoginContext({ clientId: 'flag-id', clientSecret: 'flag-secret' }, config);

    expect(ctx.clientId).toBe('flag-id');
    expect(ctx.clientSecret).toBe('flag-secret');
  });

  it('should use the stored shared client for a shared login', () => {
    const ctx = buildAuthLoginContext({}, config);

    expect(ctx.product).toBeUndefined();
    expect(ctx.clientId).toBe('shared-id');
    expect(ctx.redirectUri).toBe('http://localhost:9000/callback');
    expect(ctx.region).toBe('eu');
  });

  it('should prefer the stored product client over shared', () => {
    const ctx = buildAuthLoginContext({ product: 'sign' }, config);

    expect(ctx.clientId).toBe('sign-id');
    expect(ctx.redirectUri).toBe('http://localhost:9100/callback');
    expect(ctx.region).toBe('in');
  });

  it('should fall back to the shared client for a product without a dedicated client', () => {
    expect(buildAuthLoginContext({ product: 'crm' }, config).clientId).toBe('shared-id');
  });

  // a dedicated-client product authorized with the shared client gets a grant without its own scopes
  it('should never borrow the shared client for a dedicated-client product', () => {
    const ctx = buildAuthLoginContext({ product: 'analytics' }, config);

    expect(ctx.clientId).toBeUndefined();
    expect(ctx.clientSecret).toBeUndefined();
    expect(ctx.redirectUri).toBe(DEFAULT_AUTH_LOGIN_REDIRECT_URI);
  });

  it('should treat an empty stored value as absent', () => {
    const ctx = buildAuthLoginContext({ product: 'crm' }, { shared: { clientId: '', clientSecret: '', refreshToken: '' }, crm: { clientId: '' } });

    expect(ctx.clientId).toBeUndefined();
  });

  it('should default the redirect URI and region with nothing stored', () => {
    const ctx = buildAuthLoginContext({}, undefined);

    expect(ctx.redirectUri).toBe(DEFAULT_AUTH_LOGIN_REDIRECT_URI);
    expect(ctx.region).toBe('us');
  });

  it('should prefer the region and redirect URI flags', () => {
    const ctx = buildAuthLoginContext({ region: 'ca', redirectUri: 'http://127.0.0.1:7000/cb' }, config);

    expect(ctx.region).toBe('ca');
    expect(ctx.redirectUri).toBe('http://127.0.0.1:7000/cb');
  });

  it('should request the product scopes plus the profile scope', () => {
    expect(buildAuthLoginContext({ product: 'sign' }, config).scopes).toEqual([...ZOHO_CLI_PRODUCT_SCOPES.sign, ZOHO_ACCOUNTS_PROFILE_READ_SCOPE]);
    expect(buildAuthLoginContext({}, config).scopes).toContain(ZOHO_CLI_PRODUCT_SCOPES.desk[0]);
  });
});

describe('saveAuthLoginResult()', () => {
  let clearedEnv: [string, string][] = [];

  beforeEach(() => {
    rmSync(join(testHome, '.zoho-cli'), { recursive: true, force: true });

    clearedEnv = Object.entries(process.env).filter(([key, value]) => key.startsWith('ZOHO_') && value != null) as [string, string][];
    clearedEnv.forEach(([key]) => delete process.env[key]);
  });

  afterEach(() => {
    clearedEnv.forEach(([key, value]) => {
      process.env[key] = value;
    });

    rmSync(testHome, { recursive: true, force: true });
  });

  const result: AuthLoginResult = { clientId: 'new-id', clientSecret: 'new-secret', refreshToken: 'new-token', region: 'eu', redirectUri: DEFAULT_AUTH_LOGIN_REDIRECT_URI };

  /**
   * Guards against the `node:os` mock silently not applying, which would point every test in this
   * file at the developer's real `~/.zoho-cli/config.json` and overwrite their credentials.
   */
  it('should write inside the temporary home rather than the real one', () => {
    expect(getConfigFilePath().startsWith(testHome)).toBe(true);
  });

  it('should store a shared login in the shared block', async () => {
    await saveAuthLoginResult(buildAuthLoginContext({}, undefined), result);

    const fileConfig = await loadCliConfigFile();

    expect(fileConfig?.shared).toEqual({ ...creds, clientId: 'new-id', clientSecret: 'new-secret', refreshToken: 'new-token', region: 'eu', redirectUri: DEFAULT_AUTH_LOGIN_REDIRECT_URI });
    expect(fileConfig?.desk).toBeUndefined();
  });

  it('should store the desk org id on a shared login that was given one', async () => {
    await saveAuthLoginResult(buildAuthLoginContext({ orgId: '999' }, undefined), result);

    expect((await loadCliConfigFile())?.desk?.orgId).toBe('999');
  });

  it('should store a product login in the product block and leave shared untouched', async () => {
    await mergeCliConfig({ shared: { ...creds, region: 'us' } });

    await saveAuthLoginResult(buildAuthLoginContext({ product: 'analytics', orgId: '783021215' }, undefined), result);

    const fileConfig = await loadCliConfigFile();

    expect(fileConfig?.shared).toEqual({ ...creds, region: 'us' });
    expect(fileConfig?.analytics?.clientId).toBe('new-id');
    expect(fileConfig?.analytics?.refreshToken).toBe('new-token');
    expect(fileConfig?.analytics?.region).toBe('eu');
    expect(fileConfig?.analytics?.redirectUri).toBe(DEFAULT_AUTH_LOGIN_REDIRECT_URI);
    expect(fileConfig?.analytics?.orgId).toBe('783021215');
  });

  it('should not store an org id for a product that is not org-scoped', async () => {
    await saveAuthLoginResult(buildAuthLoginContext({ product: 'sign', orgId: '783021215' }, undefined), result);

    expect((await loadCliConfigFile())?.sign?.orgId).toBeUndefined();
  });

  it('should keep a stored org id when the login omits --org-id', async () => {
    await mergeCliConfig({ analytics: { ...creds, orgId: '783021215' } });

    await saveAuthLoginResult(buildAuthLoginContext({ product: 'analytics' }, undefined), result);

    const fileConfig = await loadCliConfigFile();

    expect(fileConfig?.analytics?.orgId).toBe('783021215');
    expect(fileConfig?.analytics?.refreshToken).toBe('new-token');
  });
});
