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
const testHome = vi.hoisted(() => `${process.env['TMPDIR']?.replace(/\/$/, '') ?? '/tmp'}/zoho-cli-config-spec-${process.pid}`);

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>();
  return { ...actual, homedir: () => testHome };
});

import { getConfigFilePath, loadCliConfig, mergeCliConfig } from './cli.config';

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
});
