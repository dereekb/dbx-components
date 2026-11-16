import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as NodeOs from 'node:os';

/**
 * Home directory the CLI config functions are pointed at for this file (see `cli.config.merge.spec.ts`).
 */
const testHome = vi.hoisted(() => `${process.env['TMPDIR']?.replace(/\/$/, '') ?? '/tmp'}/zoho-cli-token-source-spec-${process.pid}`);

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>();
  return { ...actual, homedir: () => testHome };
});

import { MS_IN_HOUR } from '@dereekb/util';
import { CLI_TOKEN_SOURCE_FAILED_ERROR_CODE, CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE, CliError, DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR } from '@dereekb/dbx-cli';
import {
  configuredProducts,
  getConfigFilePath,
  getTokenCachePath,
  loadCliConfig,
  mergeCliConfig,
  resolveZohoCliActiveTokenSource,
  saveCliTokenSourceConfig,
  updateCliTokenSourceConfig,
  zohoCliProductOrgId,
  ZOHO_CLI_TOKEN_COMMAND_ENV_VAR,
  ZOHO_CLI_TOKEN_SOURCE_ENV_VAR,
  type ZohoCliConfig,
  type ZohoCliTokenSourceCoverage
} from './cli.config';
import { createZohoCliTokenSource, loadZohoCliResolvedTokenSource, loadZohoCliTokenSourceStatus, zohoCliTokenSourceCacheKey, zohoCliTokenSourceCoverage, zohoCliTokenSourceReport, zohoCliTokenSourceStatusError, zohoCliTokenSourceTokenFromBundle, type ZohoCliTokenSourceBundle } from './token.source';
import { createCliContext } from '../context/cli.context';

const sharedCreds = {
  clientId: 'shared-id',
  clientSecret: 'shared-secret',
  refreshToken: 'shared-token'
};

const MINTED_ACCESS_TOKEN = 'minted-access-token';

/**
 * The dbx-cli error envelope a failing bundle command prints.
 */
interface BundleCommandFailure {
  readonly error: string;
  readonly code?: string;
  readonly serverCode?: string;
  readonly suggestion?: string;
}

interface BundleCommand {
  readonly command: string;
  /**
   * How many times the command has run.
   */
  readonly runs: () => number;
}

/**
 * Writes a script that prints a token bundle — only when run as a credential process, like dbx-cli's
 * `external-token` — and counts its runs, and returns the command that runs it.
 *
 * @param bundle - Overrides merged over the default bundle.
 * @param failWith - When set, the script prints a dbx-cli error envelope instead: this message (code `NOT_LOGGED_IN`), or the whole envelope.
 * @returns The command and its run counter.
 */
function bundleCommand(bundle: Partial<ZohoCliTokenSourceBundle> = {}, failWith?: string | BundleCommandFailure): BundleCommand {
  const dir = join(testHome, 'bin');
  mkdirSync(dir, { recursive: true });

  const counterPath = join(dir, `runs-${Math.random().toString(36).slice(2)}.txt`);
  const scriptPath = join(dir, `bundle-${Math.random().toString(36).slice(2)}.cjs`);
  const fullBundle: ZohoCliTokenSourceBundle = {
    uid: 'user-1',
    providerType: 'zoho_admin',
    accessToken: MINTED_ACCESS_TOKEN,
    scopes: ['ZohoCRM.modules.ALL', 'Desk.tickets.ALL', 'AaaServer.profile.READ'],
    expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString(),
    extra: { apiDomain: 'https://www.zohoapis.eu', location: 'eu' },
    hints: { zohoDeskOrgId: 'hint-desk-org' },
    ...bundle
  };

  writeFileSync(
    scriptPath,
    `const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(counterPath)}, 'x');
if (process.env[${JSON.stringify(DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR)}] !== '1') {
  process.stdout.write(JSON.stringify({ ok: false, error: 'not run as a credential process', code: 'NOT_CREDENTIAL_PROCESS' }));
  process.exit(1);
}
const failWith = ${JSON.stringify(typeof failWith === 'string' ? { error: failWith, code: 'NOT_LOGGED_IN' } : (failWith ?? null))};
if (failWith) {
  process.stdout.write(JSON.stringify({ ok: false, ...failWith }));
  process.exit(1);
}
process.stdout.write(JSON.stringify(${JSON.stringify(fullBundle)}));
`
  );

  return {
    command: `"${process.execPath}" "${scriptPath}"`,
    runs: () => {
      let count: number;

      try {
        count = readFileSync(counterPath, 'utf8').length;
      } catch {
        count = 0;
      }

      return count;
    }
  };
}

function readTokenFile(): Record<string, unknown> {
  return JSON.parse(readFileSync(getTokenCachePath(), 'utf8')) as Record<string, unknown>;
}

describe('zoho-cli token source', () => {
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
    expect(getTokenCachePath().startsWith(testHome)).toBe(true);
  });

  // the generic selection rules are covered by dbx-cli's token-source spec; these cover zoho-cli's apiMode
  describe('resolveZohoCliActiveTokenSource()', () => {
    const named: ZohoCliConfig['tokenSources'] = { dev: { command: 'dev-cmd', apiMode: 'sandbox' }, prod: { command: 'prod-cmd' } };

    it('should let an env name beat the env override command and carry the api mode', () => {
      process.env[ZOHO_CLI_TOKEN_COMMAND_ENV_VAR] = 'env-cmd';
      process.env[ZOHO_CLI_TOKEN_SOURCE_ENV_VAR] = 'dev';
      expect(resolveZohoCliActiveTokenSource({ tokenSources: named, activeTokenSource: 'prod' })).toEqual({ command: 'dev-cmd', apiMode: 'sandbox', origin: 'env', name: 'dev' });
    });

    it('should name zoho-cli and its env vars in the unknown-source error', () => {
      process.env[ZOHO_CLI_TOKEN_SOURCE_ENV_VAR] = 'staging';
      let error: unknown;

      try {
        resolveZohoCliActiveTokenSource({ tokenSource: { command: 'saved-cmd' }, tokenSources: named });
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toBe('Unknown token source "staging" (from ZOHO_CLI_TOKEN_SOURCE). Saved token sources: default, dev, prod.');
      expect((error as CliError).code).toBe(CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE);
      expect((error as CliError).suggestion).toBe('Save it with: zoho-cli auth token-source set "<command>" --name staging');
    });

    it('should throw rather than treat an unknown api mode as production', () => {
      const fileConfig = { tokenSources: { dev: { command: 'dev-cmd', apiMode: 'sandbx' } } } as unknown as ZohoCliConfig;
      expect(() => resolveZohoCliActiveTokenSource(fileConfig, { tokenSourceName: 'dev' })).toThrow('unknown apiMode "sandbx"');
    });
  });

  describe('loadCliConfig()', () => {
    it('should load a config from the env override alone', async () => {
      process.env[ZOHO_CLI_TOKEN_COMMAND_ENV_VAR] = 'env-cmd';
      expect((await loadCliConfig())?.tokenSource?.command).toBe('env-cmd');
    });

    it('should resolve the env override over the saved command', async () => {
      await saveCliTokenSourceConfig({ command: 'saved-cmd' });
      expect((await loadCliConfig())?.tokenSource?.command).toBe('saved-cmd');

      process.env[ZOHO_CLI_TOKEN_COMMAND_ENV_VAR] = 'env-cmd';
      expect((await loadCliConfig())?.tokenSource?.command).toBe('env-cmd');
    });

    it('should keep the saved token source through a credential merge', async () => {
      await saveCliTokenSourceConfig({ command: 'saved-cmd' });
      await mergeCliConfig({ shared: { ...sharedCreds } });

      expect((await loadCliConfig())?.tokenSource?.command).toBe('saved-cmd');
    });

    it('should keep the named token sources and the selection through a credential merge', async () => {
      await updateCliTokenSourceConfig({ tokenSources: { dev: { command: 'dev-cmd', apiMode: 'sandbox' } }, activeTokenSource: 'dev' });
      await mergeCliConfig({ shared: { ...sharedCreds } });

      expect(await loadCliConfig()).toMatchObject({ tokenSource: { command: 'dev-cmd', apiMode: 'sandbox' } });
    });

    it('should resolve the source selected by --token-source', async () => {
      await updateCliTokenSourceConfig({ tokenSource: { command: 'saved-cmd' }, tokenSources: { dev: { command: 'dev-cmd', apiMode: 'sandbox' } } });

      expect((await loadCliConfig())?.tokenSource).toEqual({ command: 'saved-cmd' });
      expect((await loadCliConfig({ tokenSourceName: 'dev' }))?.tokenSource).toEqual({ command: 'dev-cmd', apiMode: 'sandbox' });
    });

    it('should not resolve the token source when skipped, so an unknown selection cannot fail a credential command', async () => {
      await mergeCliConfig({ shared: { ...sharedCreds } });
      process.env[ZOHO_CLI_TOKEN_SOURCE_ENV_VAR] = 'missing';

      await expect(loadCliConfig()).rejects.toThrow('Unknown token source "missing"');
      expect((await loadCliConfig({ skipTokenSource: true }))?.shared.clientId).toBe('shared-id');
    });
  });

  describe('zohoCliTokenSourceTokenFromBundle()', () => {
    it('should normalize the datacenter, scopes, and hints', () => {
      const { token, hasExpiry } = zohoCliTokenSourceTokenFromBundle({
        bundle: { uid: 'u', providerType: 'zoho_admin', accessToken: 'a', scopes: ['ZohoCRM.modules.ALL'], expiresAt: '2030-01-01T00:00:00.000Z', extra: { apiDomain: 'https://www.zohoapis.eu', location: 'eu', ignored: 1 }, hints: { zohoDeskOrgId: '123' } }
      });

      expect(hasExpiry).toBe(true);
      expect(token).toEqual({ accessToken: 'a', scopes: ['ZohoCRM.modules.ALL'], expiresAt: '2030-01-01T00:00:00.000Z', location: 'eu', apiDomain: 'https://www.zohoapis.eu', hints: { zohoDeskOrgId: '123' }, providerType: 'zoho_admin' });
    });

    it('should split a scope list element that holds a space-joined scope string', () => {
      const { token } = zohoCliTokenSourceTokenFromBundle({ bundle: { uid: 'u', providerType: 'zoho_admin', accessToken: 'a', scopes: ['ZohoCRM.modules.ALL ZohoRecruit.modules.ALL Desk.tickets.ALL'] } });

      expect(token.scopes).toEqual(['ZohoCRM.modules.ALL', 'ZohoRecruit.modules.ALL', 'Desk.tickets.ALL']);
      expect(zohoCliTokenSourceCoverage(token).products).toEqual(['recruit', 'crm', 'desk']);
    });

    it('should fill a missing expiry with the default lifetime', () => {
      const now = new Date('2030-01-01T00:00:00.000Z');
      const { token, hasExpiry } = zohoCliTokenSourceTokenFromBundle({ bundle: { uid: 'u', providerType: 'zoho_admin', accessToken: 'a' }, now });

      expect(hasExpiry).toBe(false);
      expect(token.expiresAt).toBe('2030-01-01T00:05:00.000Z');
      expect(token.scopes).toEqual([]);
    });

    it('should throw without echoing the bundle when it has no access token', () => {
      expect(() => zohoCliTokenSourceTokenFromBundle({ bundle: { uid: 'secret-uid', providerType: 'zoho_admin', accessToken: '' } })).toThrow('did not return an access token');
    });
  });

  // the generic caching, dedupe, and reset are covered by dbx-cli's token-source spec; these cover the Zoho token shape
  describe('createZohoCliTokenSource()', () => {
    it('should cache the Zoho token, with its datacenter lifted out of the bundle extras, under the hashed command', async () => {
      const { command, runs } = bundleCommand();
      const token = await createZohoCliTokenSource({ command }).loadToken();

      expect(token.accessToken).toBe(MINTED_ACCESS_TOKEN);
      expect(token.location).toBe('eu');
      expect(token.apiDomain).toBe('https://www.zohoapis.eu');
      expect(runs()).toBe(1);

      const cached = readTokenFile()[zohoCliTokenSourceCacheKey(command)] as Record<string, unknown>;
      expect(cached['accessToken']).toBe(MINTED_ACCESS_TOKEN);
      expect(cached['location']).toBe('eu');
      expect(cached['extra']).toBeUndefined();
      expect(cached['scopes']).toEqual(['ZohoCRM.modules.ALL', 'Desk.tickets.ALL', 'AaaServer.profile.READ']);
      expect(cached['hints']).toEqual({ zohoDeskOrgId: 'hint-desk-org' });
    });

    it('should read the datacenter back from a cached token instead of running the command again', async () => {
      const { command, runs } = bundleCommand();
      mkdirSync(join(testHome, '.zoho-cli'), { recursive: true });
      writeFileSync(getTokenCachePath(), JSON.stringify({ [zohoCliTokenSourceCacheKey(command)]: { accessToken: 'cached-token', scopes: ['ZohoCRM.modules.ALL'], expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString(), location: 'au', apiDomain: 'https://www.zohoapis.com.au' } }));

      const resolved = await loadZohoCliResolvedTokenSource({ shared: sharedCreds, tokenSource: { command } });

      expect(runs()).toBe(0);
      expect(resolved?.token).toMatchObject({ accessToken: 'cached-token', location: 'au', apiDomain: 'https://www.zohoapis.com.au' });
      expect(resolved?.datacenter).toBe('au');
    });

    it("should surface the command's own error", async () => {
      const { command } = bundleCommand({}, 'Not logged in. Run: demo-cli auth login');
      await expect(createZohoCliTokenSource({ command }).loadToken()).rejects.toThrow('Not logged in. Run: demo-cli auth login');
    });
  });

  describe('zohoCliProductOrgId()', () => {
    const coverage: ZohoCliTokenSourceCoverage = { products: ['desk', 'analytics'], datacenter: 'eu', hints: { zohoDeskOrgId: 'hint-desk', zohoAnalyticsOrgId: 'hint-analytics' } };

    it('should prefer the config/env org id over the hint', () => {
      const config: ZohoCliConfig = { shared: { ...sharedCreds }, desk: { orgId: 'config-desk' } };
      expect(zohoCliProductOrgId({ config, product: 'desk', tokenSource: coverage })).toBe('config-desk');
    });

    it('should fall back to the hint for a covered product', () => {
      const config: ZohoCliConfig = { shared: { ...sharedCreds } };
      expect(zohoCliProductOrgId({ config, product: 'desk', tokenSource: coverage })).toBe('hint-desk');
      expect(zohoCliProductOrgId({ config, product: 'analytics', tokenSource: coverage })).toBe('hint-analytics');
    });

    it('should ignore the hint for a product the token source does not cover', () => {
      const config: ZohoCliConfig = { shared: { ...sharedCreds } };
      expect(zohoCliProductOrgId({ config, product: 'desk', tokenSource: { ...coverage, products: ['crm'] } })).toBeUndefined();
    });

    it('should leave the org id to be found on demand when neither is set', () => {
      const config: ZohoCliConfig = { shared: { ...sharedCreds } };
      expect(zohoCliProductOrgId({ config, product: 'analytics', tokenSource: { ...coverage, hints: undefined } })).toBeUndefined();
    });

    it('should only count a covered desk as configured once an org id is known', () => {
      const config: ZohoCliConfig = { shared: { clientId: '', clientSecret: '', refreshToken: '' } };

      expect(configuredProducts(config, { ...coverage, hints: undefined })).toEqual(['analytics']);
      expect(configuredProducts(config, coverage)).toEqual(['desk', 'analytics']);
    });
  });

  describe('createCliContext() with a token source', () => {
    async function setupContext() {
      const { command, runs } = bundleCommand();
      await mergeCliConfig({ shared: { ...sharedCreds, region: 'us', apiMode: 'production' }, desk: { orgId: 'config-desk-org' } });
      await saveCliTokenSourceConfig({ command });

      const config = (await loadCliConfig()) as ZohoCliConfig;
      const tokenSource = await loadZohoCliResolvedTokenSource(config);
      const context = createCliContext(config, tokenSource);

      return { command, runs, config, tokenSource, context };
    }

    it('should resolve the covered products and datacenter from the token', async () => {
      const { tokenSource } = await setupContext();

      expect(tokenSource?.products).toEqual(['crm', 'desk']);
      expect(tokenSource?.datacenter).toBe('eu');
    });

    it('should override the credentials of the covered products', async () => {
      const { context } = await setupContext();
      const crmApi = context.crmApi;

      expect(crmApi?.crmContext.config.apiUrl).toBe('https://www.zohoapis.eu/crm');
      expect(crmApi?.zohoAccountsApi.accountsContext.config.clientId).toBe('');
      expect(crmApi?.zohoAccountsApi.accountsContext.config.tokenRefresher).toBeDefined();
      expect(await crmApi?.crmContext.accessTokenStringFactory()).toBe(MINTED_ACCESS_TOKEN);
    });

    it('should keep the credentials of the products the token does not cover', async () => {
      const { context } = await setupContext();
      const recruitApi = context.recruitApi;

      expect(recruitApi?.recruitContext.config.apiUrl).toBe('https://recruit.zoho.com/recruit');
      expect(recruitApi?.zohoAccountsApi.accountsContext.config.clientId).toBe('shared-id');
      expect(recruitApi?.zohoAccountsApi.accountsContext.config.tokenRefresher).toBeUndefined();
      expect(context.signApi).toBeUndefined();
    });

    it('should use the config org id over the hint for a covered org-scoped product', async () => {
      const { context, config, tokenSource } = await setupContext();

      expect(context.deskApi?.deskContext.config.apiUrl).toBe('https://desk.zoho.eu/api/v1');
      expect(context.deskApi?.deskContext.config.orgId).toBe('config-desk-org');
      expect(configuredProducts(config, tokenSource)).toEqual(['recruit', 'crm', 'desk']);
    });

    it('should share one token-source accounts api across the covered products and run the command once', async () => {
      const { context, runs } = await setupContext();

      expect(context.crmApi?.zohoAccountsApi).toBe(context.deskApi?.zohoAccountsApi);
      await context.crmApi?.crmContext.accessTokenStringFactory();
      await context.deskApi?.deskContext.accessTokenStringFactory();
      expect(runs()).toBe(1);
    });

    it('should re-run the command after a rejected token resets the accounts api', async () => {
      const { context, runs } = await setupContext();
      const loadAccessToken = context.crmApi!.zohoAccountsApi.accountsContext.loadAccessToken;

      await loadAccessToken();
      await loadAccessToken.resetAccessToken();
      await loadAccessToken();

      expect(runs()).toBe(2);
    });

    it('should leave the stored credential blocks untouched', async () => {
      const { config } = await setupContext();

      expect(config.shared.clientId).toBe('shared-id');
      expect(config.crm).toBeUndefined();
    });

    it("should call the covered products' sandboxes for a sandbox source, and production for products without one", async () => {
      const { command } = bundleCommand();
      await mergeCliConfig({ desk: { orgId: 'config-desk-org' } });
      await updateCliTokenSourceConfig({ tokenSources: { dev: { command, apiMode: 'sandbox' } } });

      const config = (await loadCliConfig({ tokenSourceName: 'dev' })) as ZohoCliConfig;
      const tokenSource = await loadZohoCliResolvedTokenSource(config);
      const context = createCliContext(config, tokenSource);

      expect(tokenSource?.source.apiMode).toBe('sandbox');
      expect(context.crmApi?.crmContext.config.apiUrl).toBe('https://crmsandbox.zoho.eu/crm');
      expect(context.deskApi?.deskContext.config.apiUrl).toBe('https://desk.zoho.eu/api/v1');
    });
  });

  describe('loadZohoCliTokenSourceStatus()', () => {
    it('should report the source without the token', async () => {
      const { command } = bundleCommand();
      const status = await loadZohoCliTokenSourceStatus({ tokenSource: { command } });
      const report = zohoCliTokenSourceReport(status!);

      expect(report).toMatchObject({ command, origin: 'config', apiMode: 'production', products: ['crm', 'desk'], datacenter: 'eu', scopes: ['ZohoCRM.modules.ALL', 'Desk.tickets.ALL', 'AaaServer.profile.READ'], hints: { zohoDeskOrgId: 'hint-desk-org' } });
      expect(report.error).toBeUndefined();
      expect(JSON.stringify(report)).not.toContain(MINTED_ACCESS_TOKEN);
    });

    it('should capture a failing source as an error', async () => {
      const { command } = bundleCommand({ accessToken: '' });
      const status = await loadZohoCliTokenSourceStatus({ tokenSource: { command } });

      expect(status?.resolved).toBeUndefined();
      expect(zohoCliTokenSourceReport(status!).error).toContain('did not return an access token');
    });

    it("should keep the command's error code, server code and suggestion", async () => {
      const { command } = bundleCommand({}, { error: 'external-token zoho_admin failed: Forbidden', code: 'AUTH_FORBIDDEN', serverCode: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR', suggestion: 'Re-mint the credential.' });
      const status = await loadZohoCliTokenSourceStatus({ tokenSource: { command } });

      expect(status).toMatchObject({ errorCode: 'AUTH_FORBIDDEN', serverCode: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR', suggestion: 'Re-mint the credential.' });
      expect(zohoCliTokenSourceReport(status!)).toMatchObject({ command, origin: 'config', apiMode: 'production', errorCode: 'AUTH_FORBIDDEN', serverCode: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR', suggestion: 'Re-mint the credential.' });
      expect(zohoCliTokenSourceReport(status!).error).toContain('external-token zoho_admin failed: Forbidden');
    });

    it('should return undefined when no source is active', async () => {
      expect(await loadZohoCliTokenSourceStatus(undefined)).toBeUndefined();
    });

    it('should report the selected named source with its api mode', async () => {
      const { command } = bundleCommand();
      const status = await loadZohoCliTokenSourceStatus({ tokenSource: { command: 'unused-cmd' }, tokenSources: { dev: { command, apiMode: 'sandbox' } } }, { tokenSourceName: 'dev' });

      expect(status?.resolved?.source.apiMode).toBe('sandbox');
      expect(zohoCliTokenSourceReport(status!)).toMatchObject({ command, origin: 'flag', name: 'dev', apiMode: 'sandbox', products: ['crm', 'desk'] });
    });
  });

  describe('zohoCliTokenSourceStatusError()', () => {
    it('should return undefined for a loaded source', async () => {
      const { command } = bundleCommand();
      const status = await loadZohoCliTokenSourceStatus({ tokenSource: { command } });

      expect(zohoCliTokenSourceStatusError({ status: status! })).toBeUndefined();
    });

    it("should carry the command's code, server code and suggestion, with the report as data", async () => {
      const { command } = bundleCommand({}, { error: 'external-token zoho_admin failed: Forbidden', code: 'AUTH_FORBIDDEN', serverCode: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR', suggestion: 'Re-mint the credential.' });
      const status = await loadZohoCliTokenSourceStatus({ tokenSource: { command } });
      const data = { configured: true, tokenSource: zohoCliTokenSourceReport(status!) };
      const error = zohoCliTokenSourceStatusError({ status: status!, data });

      expect(error).toBeInstanceOf(CliError);
      expect(error?.message).toBe(`Token source "default" ("${command}", from config file) failed: external-token zoho_admin failed: Forbidden`);
      expect(error).toMatchObject({ code: 'AUTH_FORBIDDEN', serverCode: 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR', suggestion: 'Re-mint the credential.', data });
    });

    it('should fall back to TOKEN_SOURCE_FAILED and a run-it-directly suggestion for a failure with no code', async () => {
      const { command } = bundleCommand({ accessToken: '' });
      const status = await loadZohoCliTokenSourceStatus({ tokenSource: { command } });
      const error = zohoCliTokenSourceStatusError({ status: status! });

      expect(error?.code).toBe(CLI_TOKEN_SOURCE_FAILED_ERROR_CODE);
      expect(error?.serverCode).toBeUndefined();
      expect(error?.suggestion).toContain('directly');
    });
  });
});
