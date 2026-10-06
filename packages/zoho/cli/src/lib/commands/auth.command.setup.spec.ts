import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type * as NodeOs from 'node:os';

/**
 * Home directory the CLI config functions are pointed at for this file.
 *
 * Hoisted alongside the `node:os` mock, which vitest lifts above the imports — so the path cannot
 * come from a normal module-scope const. Derived rather than created on disk here: nothing may run
 * before the mock, and `mergeCliConfig` creates the directory itself.
 */
const testHome = vi.hoisted(() => `${process.env['TMPDIR']?.replace(/\/$/, '') ?? '/tmp'}/zoho-cli-auth-setup-spec-${process.pid}`);

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>();
  return { ...actual, homedir: () => testHome };
});

import { getConfigFilePath, loadCliConfig, loadCliConfigFile, mergeCliConfig } from '../config/cli.config';
import { authSetupAuthorizationUrl, buildAuthSetupContext, saveAuthSetupStep1Config, type AuthSetupArgv } from './auth.command';

const creds = {
  clientId: 'id',
  clientSecret: 'secret',
  refreshToken: 'token'
};

/**
 * Runs step 1 of `auth setup` (no `--code`, no `--token`) against the temporary config home, the
 * same way the command handler does: resolve the argv against what is on disk, then persist.
 */
async function runAuthSetupStep1(argv: AuthSetupArgv) {
  const existingConfig = await loadCliConfig();
  return saveAuthSetupStep1Config(buildAuthSetupContext(argv, existingConfig));
}

describe('auth setup (step 1)', () => {
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

  // --org-id is accepted and documented for analytics, but step 1 gated it on `product === 'desk'`
  // and dropped it — leaving every analytics call but `orgs list` without the org it must be scoped to
  it('should persist the org id for an org-scoped product', async () => {
    await runAuthSetupStep1({ product: 'analytics', clientId: 'analytics-id', clientSecret: 'analytics-secret', orgId: '783021215', apiMode: 'production' });

    const config = await loadCliConfig();

    expect(config?.analytics?.clientId).toBe('analytics-id');
    expect(config?.analytics?.orgId).toBe('783021215');
  });

  // the clobber regression: step 1 always emits an orgId key, so re-running it merely to re-print
  // the auth URL used to overwrite a working org id with undefined
  it('should preserve a stored org id when re-run without --org-id', async () => {
    await mergeCliConfig({ analytics: { ...creds, orgId: '783021215' } });

    await runAuthSetupStep1({ product: 'analytics', apiMode: 'production' });

    const config = await loadCliConfig();

    expect(config?.analytics?.orgId).toBe('783021215');
    expect(config?.analytics?.refreshToken).toBe('token');
  });

  it('should preserve a stored desk org id when a shared re-run omits --org-id', async () => {
    await runAuthSetupStep1({ clientId: 'shared-id', clientSecret: 'shared-secret', orgId: '999', apiMode: 'production' });
    await runAuthSetupStep1({ clientId: 'shared-id', clientSecret: 'shared-secret', apiMode: 'production' });

    expect((await loadCliConfig())?.desk?.orgId).toBe('999');
  });

  it('should not store an org id for a product that is not org-scoped', async () => {
    await runAuthSetupStep1({ product: 'recruit', clientId: 'recruit-id', clientSecret: 'recruit-secret', orgId: '783021215', apiMode: 'production' });

    const config = await loadCliConfig();

    expect(config?.recruit?.clientId).toBe('recruit-id');
    expect(config?.recruit?.orgId).toBeUndefined();
  });

  // a dedicated-client product must not overwrite the shared recruit/crm/desk client
  it('should leave the shared client alone when a product is targeted', async () => {
    await mergeCliConfig({ shared: { ...creds, region: 'us', apiMode: 'production' } });

    await runAuthSetupStep1({ product: 'analytics', clientId: 'analytics-id', clientSecret: 'analytics-secret', orgId: '783021215', apiMode: 'production' });

    const config = await loadCliConfig();

    expect(config?.shared?.clientId).toBe('id');
    expect(config?.shared?.refreshToken).toBe('token');
  });

  // the env-layered config used to be written back as the shared block, copying env secrets into the file
  it('should not copy env credentials into the file on a product setup', async () => {
    process.env['ZOHO_ACCOUNTS_CLIENT_ID'] = 'env-id';
    process.env['ZOHO_ACCOUNTS_CLIENT_SECRET'] = 'env-secret';
    process.env['ZOHO_ACCOUNTS_REFRESH_TOKEN'] = 'env-token';

    await runAuthSetupStep1({ product: 'sign', clientId: 'sign-id', clientSecret: 'sign-secret', apiMode: 'production' });

    expect(JSON.stringify(await loadCliConfigFile())).not.toContain('env-token');
  });

  it('should keep a stored refresh token when step 1 is re-run', async () => {
    await mergeCliConfig({ shared: { ...creds } });

    await runAuthSetupStep1({ clientId: 'id', clientSecret: 'secret', apiMode: 'production' });

    expect((await loadCliConfigFile())?.shared?.refreshToken).toBe('token');
  });
});

describe('authSetupAuthorizationUrl()', () => {
  // without prompt=consent a re-consent comes back without a refresh token
  it('should request offline access with a forced consent screen and no state', () => {
    const { authorizationUrl, scopes } = authSetupAuthorizationUrl(buildAuthSetupContext({ clientId: 'client-id', clientSecret: 'secret', region: 'eu' }, undefined));
    const url = new URL(authorizationUrl);

    expect(url.origin).toBe('https://accounts.zoho.eu');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost/oauth');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.has('state')).toBe(false);
    expect(url.searchParams.get('scope')).toBe(scopes.join(','));
  });

  it('should request only the targeted product scopes', () => {
    const { scopes } = authSetupAuthorizationUrl(buildAuthSetupContext({ product: 'sign', clientId: 'client-id', clientSecret: 'secret', scopes: 'recruit' }, undefined));

    expect(scopes.some((x) => x.startsWith('ZohoSign.'))).toBe(true);
    expect(scopes.some((x) => x.startsWith('ZohoRecruit.'))).toBe(false);
  });
});

describe('buildAuthSetupContext() --code', () => {
  it('should take the code and issuing datacenter from a pasted redirect URL', () => {
    const ctx = buildAuthSetupContext({ code: 'http://localhost/oauth?code=1000.abc&location=eu&accounts-server=https%3A%2F%2Faccounts.zoho.eu', region: 'us' }, undefined);

    expect(ctx.code).toBe('1000.abc');
    expect(ctx.region).toBe('eu');
    expect(ctx.accountsUrl).toBe('https://accounts.zoho.eu');
  });

  it('should accept a bare code', () => {
    const ctx = buildAuthSetupContext({ code: '1000.abc', region: 'in' }, undefined);

    expect(ctx.code).toBe('1000.abc');
    expect(ctx.region).toBe('in');
  });
});
