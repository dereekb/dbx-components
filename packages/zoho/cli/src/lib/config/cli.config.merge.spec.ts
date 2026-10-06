import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type * as NodeOs from 'node:os';

/**
 * Home directory the CLI config functions are pointed at for this file.
 *
 * Hoisted alongside the `node:os` mock, which vitest lifts above the imports — so the path cannot
 * come from a normal module-scope const. Derived rather than created on disk here: nothing may run
 * before the mock, and `mergeCliConfig` creates the directory itself.
 */
const testHome = vi.hoisted(() => `${process.env['TMPDIR']?.replace(/\/$/, '') ?? '/tmp'}/zoho-cli-config-spec-${process.pid}`);

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>();
  return { ...actual, homedir: () => testHome };
});

import { getConfigFilePath, loadCliConfig, loadCliConfigFile, mergeCliConfig, zohoCliCredentialSources, zohoCliShadowedEnvCredentialBlocks } from './cli.config';

const creds = {
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'token'
};

describe('mergeCliConfig()', () => {
  /**
   * `ZOHO_*` env vars removed for the duration of a test, and restored after it.
   *
   * `loadCliConfig` layers env vars over the file, so a developer's own `.env.local` would
   * otherwise decide what these assertions see.
   */
  let clearedEnv: [string, string][] = [];

  beforeEach(() => {
    rmSync(join(testHome, '.zoho-cli'), { recursive: true, force: true });

    clearedEnv = Object.entries(process.env).filter(([key, value]) => key.startsWith('ZOHO_') && value != null) as [string, string][];
    clearedEnv.forEach(([key]) => delete process.env[key]);
  });

  afterEach(() => {
    // drop whatever a test exported before putting the developer's own values back
    Object.keys(process.env)
      .filter((key) => key.startsWith('ZOHO_'))
      .forEach((key) => delete process.env[key]);

    clearedEnv.forEach(([key, value]) => {
      process.env[key] = value;
    });

    rmSync(testHome, { recursive: true, force: true });
  });

  /**
   * Guards against the `node:os` mock silently not applying, which would point every test in this
   * file at the developer's real `~/.zoho-cli/config.json` and overwrite their credentials.
   */
  it('should write inside the temporary home rather than the real one', () => {
    expect(getConfigFilePath().startsWith(testHome)).toBe(true);
  });

  it('should persist an analytics block', async () => {
    const merged = await mergeCliConfig({ analytics: { ...creds, orgId: '1234567' } });

    expect(merged.analytics?.clientId).toBe('id');
    expect(merged.analytics?.orgId).toBe('1234567');
    expect((await loadCliConfig())?.analytics?.orgId).toBe('1234567');
  });

  // a product missing from the merge literal is absent from the merged result, and the save that
  // follows therefore erases it from disk — this covers that for a product other than the one updated
  it('should preserve every other product block when one product is updated', async () => {
    await mergeCliConfig({ analytics: { ...creds, orgId: '1234567' } });
    await mergeCliConfig({ sign: { ...creds, apiUrl: 'production' } });

    const config = await loadCliConfig();

    expect(config?.sign?.apiUrl).toBe('production');
    expect(config?.analytics?.orgId).toBe('1234567');
  });

  it('should shallow-merge into an existing product block', async () => {
    await mergeCliConfig({ analytics: { ...creds, orgId: '1234567' } });
    await mergeCliConfig({ analytics: { ...creds, apiUrl: 'production' } });

    const config = await loadCliConfig();

    expect(config?.analytics?.apiUrl).toBe('production');
    expect(config?.analytics?.orgId).toBe('1234567');
  });

  // callers assemble their update positionally, so `auth setup --product analytics` emits an orgId
  // key whether or not --org-id was passed — a plain spread let the omitted flag wipe a working org id
  it('should not let an undefined update value clobber a stored product value', async () => {
    await mergeCliConfig({ analytics: { ...creds, orgId: '1234567' } });
    await mergeCliConfig({ analytics: { clientId: 'id2', clientSecret: 'secret2', apiUrl: undefined, orgId: undefined } });

    const config = await loadCliConfig();

    expect(config?.analytics?.clientId).toBe('id2');
    expect(config?.analytics?.orgId).toBe('1234567');
    expect(config?.analytics?.refreshToken).toBe('token');
  });

  it('should not let an undefined update value clobber a stored shared value', async () => {
    await mergeCliConfig({ shared: { ...creds, region: 'eu', apiMode: 'sandbox' } });
    await mergeCliConfig({ shared: { ...creds, region: undefined, apiMode: undefined } });

    const config = await loadCliConfig();

    expect(config?.shared?.region).toBe('eu');
    expect(config?.shared?.apiMode).toBe('sandbox');
  });

  it('should write the config file readable by the owner only', async () => {
    await mergeCliConfig({ shared: { ...creds } });

    expect(statSync(getConfigFilePath()).mode & 0o777).toBe(0o600);
  });

  it('should not persist env-only credentials into the file', async () => {
    process.env['ZOHO_ACCOUNTS_CLIENT_ID'] = 'env-id';
    process.env['ZOHO_ACCOUNTS_CLIENT_SECRET'] = 'env-secret';
    process.env['ZOHO_ACCOUNTS_REFRESH_TOKEN'] = 'env-token';

    await mergeCliConfig({ sign: { ...creds } });

    const fileConfig = await loadCliConfigFile();

    expect(fileConfig?.shared?.refreshToken).toBe('');
    expect(JSON.stringify(fileConfig)).not.toContain('env-token');
    expect((await loadCliConfig())?.shared?.refreshToken).toBe('env-token');
  });

  it('should leave the stored shared block untouched when the update omits it', async () => {
    await mergeCliConfig({ shared: { ...creds, region: 'eu' } });
    await mergeCliConfig({ sign: { ...creds } });

    const fileConfig = await loadCliConfigFile();

    expect(fileConfig?.shared?.refreshToken).toBe('token');
    expect(fileConfig?.shared?.region).toBe('eu');
  });

  // clearOutputConfig relies on explicit undefined keys reaching dbxMergeOutputConfig, so the
  // undefined-tolerant product/shared merge must NOT be applied to the output block
  it('should still clear output config through an explicit undefined', async () => {
    await mergeCliConfig({ output: { dumpDir: '/tmp/dump', pick: 'id' } });
    await mergeCliConfig({ output: { dumpDir: undefined, pick: undefined, commands: undefined } });

    const config = await loadCliConfig();

    expect(config?.output?.dumpDir).toBeUndefined();
    expect(config?.output?.pick).toBeUndefined();
  });
});

describe('loadCliConfig()', () => {
  let clearedEnv: [string, string][] = [];

  beforeEach(() => {
    rmSync(join(testHome, '.zoho-cli'), { recursive: true, force: true });

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

  function exportSharedEnv() {
    process.env['ZOHO_ACCOUNTS_CLIENT_ID'] = 'env-id';
    process.env['ZOHO_ACCOUNTS_CLIENT_SECRET'] = 'env-secret';
    process.env['ZOHO_ACCOUNTS_REFRESH_TOKEN'] = 'env-token';
    process.env['ZOHO_ACCOUNTS_URL'] = 'eu';
  }

  it('should return undefined with no file and no credential env vars', async () => {
    expect(await loadCliConfig()).toBeUndefined();
  });

  // an `auth login` result must not be shadowed by a stale exported refresh token
  it('should prefer a stored refresh token over the env one', async () => {
    await mergeCliConfig({ shared: { ...creds, region: 'us' } });
    exportSharedEnv();

    const config = await loadCliConfig();

    expect(config?.shared?.clientId).toBe('id');
    expect(config?.shared?.refreshToken).toBe('token');
    expect(config?.shared?.region).toBe('us');
    expect(zohoCliCredentialSources(await loadCliConfigFile()).shared).toBe('config');
  });

  it('should use the env credentials when the file has none', async () => {
    exportSharedEnv();

    const config = await loadCliConfig();

    expect(config?.shared?.clientId).toBe('env-id');
    expect(config?.shared?.refreshToken).toBe('env-token');
    expect(config?.shared?.region).toBe('eu');
    expect(zohoCliCredentialSources(await loadCliConfigFile()).shared).toBe('env');
  });

  // step 1 of `auth setup` stores the client with an empty refresh token; pairing that client with an
  // env refresh token would be a grant Zoho rejects
  it('should use the env triple as a unit rather than mixing it with a partial file block', async () => {
    await mergeCliConfig({ shared: { clientId: 'file-id', clientSecret: 'file-secret', refreshToken: '' } });
    exportSharedEnv();

    const config = await loadCliConfig();

    expect(config?.shared?.clientId).toBe('env-id');
    expect(config?.shared?.clientSecret).toBe('env-secret');
    expect(config?.shared?.refreshToken).toBe('env-token');
  });

  it('should load a config from product-only env vars', async () => {
    process.env['ZOHO_SIGN_ACCOUNTS_CLIENT_ID'] = 'sign-id';
    process.env['ZOHO_SIGN_ACCOUNTS_CLIENT_SECRET'] = 'sign-secret';
    process.env['ZOHO_SIGN_ACCOUNTS_REFRESH_TOKEN'] = 'sign-token';

    const config = await loadCliConfig();

    expect(config?.sign?.clientId).toBe('sign-id');
    expect(config?.sign?.refreshToken).toBe('sign-token');
    expect(zohoCliCredentialSources(await loadCliConfigFile()).sign).toBe('env');
  });

  it('should prefer a stored product login over the product env vars', async () => {
    await mergeCliConfig({ sign: { ...creds, region: 'eu' } });
    process.env['ZOHO_SIGN_ACCOUNTS_CLIENT_ID'] = 'sign-id';
    process.env['ZOHO_SIGN_ACCOUNTS_CLIENT_SECRET'] = 'sign-secret';
    process.env['ZOHO_SIGN_ACCOUNTS_REFRESH_TOKEN'] = 'sign-token';

    const config = await loadCliConfig();

    expect(config?.sign?.clientId).toBe('id');
    expect(config?.sign?.region).toBe('eu');
  });

  it('should prefer the stored api mode and org id over env', async () => {
    await mergeCliConfig({ shared: { ...creds, apiMode: 'sandbox' }, desk: { orgId: 'file-org' } });
    process.env['ZOHO_API_URL'] = 'production';
    process.env['ZOHO_DESK_ORG_ID'] = 'env-org';

    const config = await loadCliConfig();

    expect(config?.shared?.apiMode).toBe('sandbox');
    expect(config?.desk?.orgId).toBe('file-org');
  });

  it('should report a stored refresh token shadowing a different env one', async () => {
    await mergeCliConfig({ shared: { ...creds } });

    expect(zohoCliShadowedEnvCredentialBlocks(await loadCliConfigFile())).toEqual([]);

    exportSharedEnv();

    expect(zohoCliShadowedEnvCredentialBlocks(await loadCliConfigFile())).toEqual(['shared']);

    process.env['ZOHO_ACCOUNTS_REFRESH_TOKEN'] = 'token';

    expect(zohoCliShadowedEnvCredentialBlocks(await loadCliConfigFile())).toEqual([]);
  });
});
