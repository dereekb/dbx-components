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

import { getConfigFilePath, loadCliConfig, mergeCliConfig } from '../config/cli.config';
import { buildAuthSetupContext, saveAuthSetupStep1Config, type AuthSetupArgv } from './auth.command';

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
  return saveAuthSetupStep1Config(buildAuthSetupContext(argv, existingConfig), existingConfig);
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
});
