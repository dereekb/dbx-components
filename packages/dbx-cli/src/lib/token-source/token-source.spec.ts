import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MS_IN_HOUR, MS_IN_MINUTE } from '@dereekb/util';
import { buildCliPaths, type CliPaths } from '../config/paths';
import { DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR } from '../util/credential-process';
import { CliError } from '../util/output';
import { type CliTokenSourceBundle, CLI_TOKEN_SOURCE_FAILED_ERROR_CODE, cliTokenSourceCacheKey, cliTokenSourceReport, cliTokenSourceStatusError, cliTokenSourceTokenFromBundle, createCliTokenSource, loadCliTokenSourceStatus, readCliTokenSourceToken } from './token-source';
import { type CliTokenSourceConfig, CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE, cliTokenSourceEnvVarNames, cliTokenSourceResolver, DEFAULT_CLI_TOKEN_SOURCE_NAME } from './token-source.config';
import { buildCliTokenSourceShowResult, clearCliTokenSource, cliTokenSourceJsonConfigStore, type CliTokenSourceCommandConfig, refreshCliTokenSource, setCliTokenSource, useCliTokenSource } from './token-source.command';

const MINTED_ACCESS_TOKEN = 'minted-access-token';

interface BundleCommand {
  readonly command: string;
  /**
   * The arguments of each run, in order.
   */
  readonly runs: () => string[][];
}

/**
 * Writes a script that prints a token bundle — only when run as a credential process, like dbx-cli's
 * `external-token` — recording the arguments of each run, and returns the command that runs it.
 *
 * @param dir - Where to write the script.
 * @param bundle - Overrides merged over the default bundle.
 * @param failWith - When set, the script prints a dbx-cli error envelope with this message instead.
 * @returns The command and its run log.
 */
function bundleCommand(dir: string, bundle: Partial<CliTokenSourceBundle> = {}, failWith?: string, failSuggestion?: string, failServerCode?: string): BundleCommand {
  mkdirSync(dir, { recursive: true });

  const id = Math.random().toString(36).slice(2);
  const runsPath = join(dir, `runs-${id}.ndjson`);
  const scriptPath = join(dir, `bundle-${id}.cjs`);
  const fullBundle: CliTokenSourceBundle = {
    uid: 'user-1',
    providerType: 'microsoft',
    accessToken: MINTED_ACCESS_TOKEN,
    scopes: ['User.Read', 'Mail.Read'],
    expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString(),
    extra: { tenantId: 'tenant-1' },
    hints: { region: 'us' },
    ...bundle
  };

  writeFileSync(
    scriptPath,
    String.raw`const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(runsPath)}, JSON.stringify(args) + '\n');
if (process.env[${JSON.stringify(DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR)}] !== '1') {
  process.stdout.write(JSON.stringify({ ok: false, error: 'not run as a credential process', code: 'NOT_CREDENTIAL_PROCESS' }));
  process.exit(1);
}
const failWith = ${JSON.stringify(failWith ?? null)};
const failSuggestion = ${JSON.stringify(failSuggestion ?? null)};
const failServerCode = ${JSON.stringify(failServerCode ?? null)};
if (failWith) {
  process.stdout.write(JSON.stringify({ ok: false, error: failWith, code: 'NOT_LOGGED_IN', ...(failServerCode ? { serverCode: failServerCode } : {}), ...(failSuggestion ? { suggestion: failSuggestion } : {}) }));
  process.exit(1);
}
const bundle = ${JSON.stringify(fullBundle)};
process.stdout.write(JSON.stringify(bundle));
`
  );

  return {
    command: `"${process.execPath}" "${scriptPath}"`,
    runs: () => {
      let lines: string[];

      try {
        lines = readFileSync(runsPath, 'utf8').split('\n');
      } catch {
        lines = [];
      }

      return lines.filter((x) => x.length > 0).map((x) => JSON.parse(x) as string[]);
    }
  };
}

describe('dbx-cli token source', () => {
  let home: string;
  let paths: CliPaths;

  const readTokenFile = () => JSON.parse(readFileSync(paths.tokenCachePath, 'utf8')) as Record<string, unknown>;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'dbx-cli-token-source-'));
    paths = buildCliPaths({ cliName: 'test-cli', configDirOverride: join(home, '.test-cli') });
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  describe('cliTokenSourceEnvVarNames()', () => {
    it('derives the env var names from the CLI name', () => {
      expect(cliTokenSourceEnvVarNames('zoho-cli')).toEqual({ tokenCommand: 'ZOHO_CLI_TOKEN_COMMAND', tokenSource: 'ZOHO_CLI_TOKEN_SOURCE' });
      expect(cliTokenSourceEnvVarNames('msgraph-cli')).toEqual({ tokenCommand: 'MSGRAPH_CLI_TOKEN_COMMAND', tokenSource: 'MSGRAPH_CLI_TOKEN_SOURCE' });
    });
  });

  describe('cliTokenSourceResolver()', () => {
    const fileConfig = { tokenSource: { command: 'saved-default' }, tokenSources: { prod: { command: ' saved-prod ' }, blank: { command: ' ' } } };

    it('returns the saved unnamed source', () => {
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      expect(resolver.resolveActiveTokenSource(fileConfig)).toEqual({ command: 'saved-default', origin: 'config', name: DEFAULT_CLI_TOKEN_SOURCE_NAME });
    });

    it('applies the selection order: flag > env name > env command > saved selection > unnamed', () => {
      const env = { TEST_CLI_TOKEN_SOURCE: 'prod', TEST_CLI_TOKEN_COMMAND: 'env-command' };
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env });

      expect(resolver.resolveActiveTokenSource({ ...fileConfig, tokenSources: { ...fileConfig.tokenSources, dev: { command: 'saved-dev' } } }, { tokenSourceName: 'dev' })).toMatchObject({ command: 'saved-dev', origin: 'flag', name: 'dev' });
      expect(resolver.resolveActiveTokenSource(fileConfig)).toMatchObject({ command: 'saved-prod', origin: 'env', name: 'prod' });
      expect(cliTokenSourceResolver({ cliName: 'test-cli', env: { TEST_CLI_TOKEN_COMMAND: 'env-command' } }).resolveActiveTokenSource({ ...fileConfig, activeTokenSource: 'prod' })).toEqual({ command: 'env-command', origin: 'env' });
      expect(cliTokenSourceResolver({ cliName: 'test-cli', env: {} }).resolveActiveTokenSource({ ...fileConfig, activeTokenSource: 'prod' })).toMatchObject({ command: 'saved-prod', origin: 'config', name: 'prod' });
    });

    it('throws for a selected name with no saved source instead of falling through', () => {
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      expect(() => resolver.resolveActiveTokenSource(fileConfig, { tokenSourceName: 'nope' })).toThrow('Unknown token source "nope" (from --token-source). Saved token sources: default, prod.');
    });

    it('throws a TOKEN_SOURCE_UNKNOWN CliError with the save hint as its suggestion', () => {
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      let error: unknown;

      try {
        resolver.resolveActiveTokenSource(fileConfig, { tokenSourceName: 'nope' });
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).code).toBe(CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE);
      expect((error as CliError).suggestion).toBe('Save it with: test-cli auth token-source set "<command>" --name nope');
    });

    it('reads and validates the extra fields of a saved block', () => {
      interface ModeSource extends CliTokenSourceConfig {
        readonly mode?: 'a' | 'b';
      }

      const resolver = cliTokenSourceResolver<ModeSource>({
        cliName: 'test-cli',
        env: {},
        readExtra: (block, name) => {
          if (block.mode != null && block.mode !== 'a' && block.mode !== 'b') {
            throw new Error(`bad mode for ${name}`);
          }

          return block.mode ? { mode: block.mode } : {};
        }
      });

      expect(resolver.savedTokenSource({ tokenSource: { command: 'x', mode: 'b' } }, DEFAULT_CLI_TOKEN_SOURCE_NAME)).toEqual({ command: 'x', mode: 'b' });
      expect(() => resolver.savedTokenSource({ tokenSource: { command: 'x', mode: 'c' as never } }, DEFAULT_CLI_TOKEN_SOURCE_NAME)).toThrow('bad mode for default');
    });

    it('lists the unnamed source first, skipping blank commands', () => {
      expect(cliTokenSourceResolver({ cliName: 'test-cli', env: {} }).savedTokenSourceNames(fileConfig)).toEqual([DEFAULT_CLI_TOKEN_SOURCE_NAME, 'prod']);
    });

    it('ignores blank env vars and returns undefined when nothing selects a source', () => {
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: { TEST_CLI_TOKEN_SOURCE: ' ', TEST_CLI_TOKEN_COMMAND: '  ' } });

      expect(resolver.resolveActiveTokenSource(fileConfig)?.origin).toBe('config');
      expect(resolver.resolveActiveTokenSource(undefined)).toBeUndefined();
    });

    it('throws for a saved selection whose source was removed, labelling where it was selected', () => {
      expect(() => cliTokenSourceResolver({ cliName: 'test-cli', env: {} }).resolveActiveTokenSource({ ...fileConfig, activeTokenSource: 'gone' })).toThrow('Unknown token source "gone" (from config file)');
      expect(() => cliTokenSourceResolver({ cliName: 'test-cli', env: { TEST_CLI_TOKEN_SOURCE: 'gone' } }).resolveActiveTokenSource(fileConfig)).toThrow('(from TEST_CLI_TOKEN_SOURCE)');
    });
  });

  describe('cliTokenSourceTokenFromBundle()', () => {
    it('keeps the extras and string hints, and splits joined scope strings', () => {
      const { token, hasExpiry } = cliTokenSourceTokenFromBundle({ bundle: { uid: 'u', providerType: 'p', accessToken: 't', tokenType: 'Bearer', scopes: ['A B', 'C'], expiresAt: '2030-01-01T00:00:00.000Z', extra: { tenantId: 'x' }, hints: { a: 'b', n: 1 as never } } });
      expect(token).toEqual({ accessToken: 't', scopes: ['A', 'B', 'C'], expiresAt: '2030-01-01T00:00:00.000Z', extra: { tenantId: 'x' }, hints: { a: 'b' }, providerType: 'p' });
      expect(hasExpiry).toBe(true);
    });

    it('fills a missing expiry with the default lifetime', () => {
      const now = new Date('2030-01-01T00:00:00.000Z');
      const { token, hasExpiry } = cliTokenSourceTokenFromBundle({ bundle: { accessToken: 't' } as CliTokenSourceBundle, now });
      expect(token.expiresAt).toBe(new Date(now.getTime() + 5 * MS_IN_MINUTE).toISOString());
      expect(hasExpiry).toBe(false);
    });

    it('throws without echoing the bundle when it has no access token', () => {
      expect(() => cliTokenSourceTokenFromBundle({ bundle: { uid: 'secret-uid' } as CliTokenSourceBundle })).toThrow('The token source did not return an access token.');
    });
  });

  describe('token settings', () => {
    const SETTINGS = { mail_signature: { me: { html: '<p>Hi</p>' }, 'support@example.com': { text: 'Hi' } } };

    it('keeps the settings from bundle to token to file and back', async () => {
      const { command } = bundleCommand(join(home, 'bin'), { settings: SETTINGS });
      const token = await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();
      expect(token.settings).toEqual(SETTINGS);

      const stored = readTokenFile()[cliTokenSourceCacheKey({ command })];
      expect(readCliTokenSourceToken(stored)?.settings).toEqual(SETTINGS);

      const reloaded = await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();
      expect(reloaded.settings).toEqual(SETTINGS);
    });

    it('drops empty or non-object settings', () => {
      const base = { uid: 'u', providerType: 'microsoft', accessToken: 'a', tokenType: 'Bearer', scopes: [], expiresAt: new Date(Date.now() + MS_IN_HOUR).toISOString() };
      expect(cliTokenSourceTokenFromBundle({ bundle: { ...base, settings: {} } }).token.settings).toBeUndefined();
      expect(cliTokenSourceTokenFromBundle({ bundle: { ...base, settings: ['x'] as never } }).token.settings).toBeUndefined();
    });
  });

  describe('cliTokenSourceCacheKey()', () => {
    it('keys by the sha256 of the command alone, so cached tokens keep hitting', () => {
      expect(cliTokenSourceCacheKey({ command: 'a' })).toBe(`tokenSource:${createHash('sha256').update('a').digest('hex')}`);
      expect(cliTokenSourceCacheKey({ command: 'a' })).not.toBe(cliTokenSourceCacheKey({ command: 'b' }));
    });
  });

  describe('createCliTokenSource()', () => {
    it('runs the command as a credential process and caches the token under the hashed command', async () => {
      const { command, runs } = bundleCommand(join(home, 'bin'));
      const token = await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();

      expect(token.accessToken).toBe(MINTED_ACCESS_TOKEN);
      expect(token.extra).toEqual({ tenantId: 'tenant-1' });
      expect(runs()).toEqual([[]]);

      const cached = readTokenFile()[cliTokenSourceCacheKey({ command })] as Record<string, unknown>;
      expect(cached['accessToken']).toBe(MINTED_ACCESS_TOKEN);
      expect(JSON.stringify(readTokenFile())).not.toContain(command);
    });

    it('shares one run between concurrent loads and reuses the cached token in a new source', async () => {
      const { command, runs } = bundleCommand(join(home, 'bin'));
      const source = createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath });
      await Promise.all([source.loadToken(), source.loadToken(), source.loadToken()]);
      await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();

      expect(runs().length).toBe(1);
    });

    it('runs the command again after a reset', async () => {
      const { command, runs } = bundleCommand(join(home, 'bin'));
      const source = createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath });
      await source.loadToken();
      await source.resetToken();
      await source.loadToken();

      expect(runs().length).toBe(2);
    });

    it('runs the command again when the cached token nears expiry', async () => {
      const { command, runs } = bundleCommand(join(home, 'bin'), { expiresAt: new Date(Date.now() + MS_IN_MINUTE).toISOString() });
      await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();
      await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();

      expect(runs().length).toBe(2);
    });

    it('keeps the other entries of the token file', async () => {
      mkdirSync(paths.configDir, { recursive: true });
      writeFileSync(paths.tokenCachePath, JSON.stringify({ other: { accessToken: 'x' } }));

      const { command } = bundleCommand(join(home, 'bin'));
      await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();

      expect(readTokenFile()['other']).toEqual({ accessToken: 'x' });
    });

    it('maps the token through mapToken, handing it the stored entry when read back', async () => {
      const { command } = bundleCommand(join(home, 'bin'));
      const stored: unknown[] = [];
      const mapToken = (token: Parameters<NonNullable<Parameters<typeof createCliTokenSource>[0]['mapToken']>>[0], entry?: unknown) => {
        stored.push(entry);
        return { ...token, tenantId: token.extra?.['tenantId'] as string };
      };

      const first = await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath, mapToken }).loadToken();
      const second = await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath, mapToken }).loadToken();

      expect(first.tenantId).toBe('tenant-1');
      expect(second.tenantId).toBe('tenant-1');
      expect(stored[0]).toBeUndefined();
      expect((stored[1] as Record<string, unknown>)['accessToken']).toBe(MINTED_ACCESS_TOKEN);
    });

    it('keeps a token without an expiry in memory only, never in the token file', async () => {
      const { command, runs } = bundleCommand(join(home, 'bin'), { expiresAt: undefined });
      const source = createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath });
      await source.loadToken();
      await source.loadToken();

      let tokens: Record<string, unknown> = {};

      try {
        tokens = readTokenFile();
      } catch {
        // no token file at all is fine
      }

      expect(tokens[cliTokenSourceCacheKey({ command })]).toBeUndefined();
      expect(runs().length).toBe(1);
    });

    it("surfaces the command's own error", async () => {
      const { command } = bundleCommand(join(home, 'bin'), {}, 'Not logged in to demo-cli.');
      await expect(createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken()).rejects.toThrow('Not logged in to demo-cli.');
    });
  });

  describe('loadCliTokenSourceStatus()', () => {
    it('captures a failing command as the status error and reports no token', async () => {
      const { command } = bundleCommand(join(home, 'bin'), {}, 'Not logged in.');
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      const status = await loadCliTokenSourceStatus({ resolver, fileConfig: { tokenSource: { command } }, tokenCachePath: paths.tokenCachePath });

      expect(status?.error).toContain('Not logged in.');
      expect(cliTokenSourceReport(status!)).toEqual({ command, origin: 'config', name: DEFAULT_CLI_TOKEN_SOURCE_NAME, error: status?.error, errorCode: 'NOT_LOGGED_IN' });
    });

    it('keeps the failing command error code and suggestion in the report', async () => {
      const { command } = bundleCommand(join(home, 'bin'), {}, 'Not logged in.', 'Run test-cli auth login.');
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      const status = await loadCliTokenSourceStatus({ resolver, fileConfig: { tokenSource: { command } }, tokenCachePath: paths.tokenCachePath });

      expect(cliTokenSourceReport(status!)).toMatchObject({ errorCode: 'NOT_LOGGED_IN', suggestion: 'Run test-cli auth login.' });
    });

    it('keeps the failing command serverCode in the status and report', async () => {
      const { command } = bundleCommand(join(home, 'bin'), {}, 'Not logged in.', 'Run test-cli auth login.', 'SERVER_CODE');
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      const status = await loadCliTokenSourceStatus({ resolver, fileConfig: { tokenSource: { command } }, tokenCachePath: paths.tokenCachePath });

      expect(status?.serverCode).toBe('SERVER_CODE');
      expect(cliTokenSourceReport(status!)).toMatchObject({ errorCode: 'NOT_LOGGED_IN', serverCode: 'SERVER_CODE', suggestion: 'Run test-cli auth login.' });
    });
  });

  describe('cliTokenSourceStatusError()', () => {
    it('returns undefined for a loaded status', async () => {
      const { command } = bundleCommand(join(home, 'bin'));
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      const status = await loadCliTokenSourceStatus({ resolver, fileConfig: { tokenSource: { command } }, tokenCachePath: paths.tokenCachePath });

      expect(cliTokenSourceStatusError({ status: status!, resolver })).toBeUndefined();
    });

    it('names the source and its origin, and passes the code, serverCode, suggestion and data through', async () => {
      const { command } = bundleCommand(join(home, 'bin'), {}, 'Not logged in.', 'Run test-cli auth login.', 'SERVER_CODE');
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      const status = await loadCliTokenSourceStatus({ resolver, fileConfig: { tokenSource: { command } }, tokenCachePath: paths.tokenCachePath });
      const data = { tokenSource: cliTokenSourceReport(status!) };
      const error = cliTokenSourceStatusError({ status: status!, resolver, data });

      expect(error).toBeInstanceOf(CliError);
      expect(error?.message).toContain(`Token source "${DEFAULT_CLI_TOKEN_SOURCE_NAME}" ("${command}", from config file) failed:`);
      expect(error?.message).toContain('Not logged in.');
      expect(error?.code).toBe('NOT_LOGGED_IN');
      expect(error?.serverCode).toBe('SERVER_CODE');
      expect(error?.suggestion).toBe('Run test-cli auth login.');
      expect(error?.data).toBe(data);
    });

    it('falls back to TOKEN_SOURCE_FAILED and a run-it-directly suggestion for a plain failure', async () => {
      const { command } = bundleCommand(join(home, 'bin'), { accessToken: '' });
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      const status = await loadCliTokenSourceStatus({ resolver, fileConfig: { tokenSource: { command } }, tokenCachePath: paths.tokenCachePath });
      const error = cliTokenSourceStatusError({ status: status!, resolver });

      expect(error?.code).toBe(CLI_TOKEN_SOURCE_FAILED_ERROR_CODE);
      expect(error?.serverCode).toBeUndefined();
      expect(error?.suggestion).toContain(`Run \`${command}\` directly`);
    });

    it('reports the keys of the token settings, never their values', async () => {
      const { command } = bundleCommand(join(home, 'bin'), { settings: { mail_signature: { me: { html: '<p>sentinel-settings-value</p>' } } } });
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      const status = await loadCliTokenSourceStatus({ resolver, fileConfig: { tokenSource: { command } }, tokenCachePath: paths.tokenCachePath });
      const report = cliTokenSourceReport(status!);

      expect(report.settings).toEqual({ mail_signature: ['me'] });
      expect(JSON.stringify(report)).not.toContain('sentinel-settings-value');
    });

    it('reports the loaded token without the access token', async () => {
      const { command } = bundleCommand(join(home, 'bin'));
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      const status = await loadCliTokenSourceStatus({ resolver, fileConfig: { tokenSource: { command } }, tokenCachePath: paths.tokenCachePath });
      const report = cliTokenSourceReport(status!);

      expect(report).toMatchObject({ scopes: ['User.Read', 'Mail.Read'], providerType: 'microsoft' });
      expect(report).not.toHaveProperty('requestedScopes');
      expect(JSON.stringify(report)).not.toContain(MINTED_ACCESS_TOKEN);
    });
  });

  describe('auth token-source functions', () => {
    let config: CliTokenSourceCommandConfig;

    beforeEach(() => {
      config = { resolver: cliTokenSourceResolver({ cliName: 'test-cli', env: {} }), tokenCachePath: paths.tokenCachePath, ...cliTokenSourceJsonConfigStore(paths) };
    });

    it('refresh drops the cached token of the source in effect without running it', async () => {
      const { command, runs } = bundleCommand(join(home, 'bin'));
      await setCliTokenSource(config, { command });
      await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();
      expect(readTokenFile()[cliTokenSourceCacheKey({ command })]).toBeDefined();

      expect(await refreshCliTokenSource(config)).toEqual({ refreshed: true, name: DEFAULT_CLI_TOKEN_SOURCE_NAME, origin: 'config' });
      expect(readTokenFile()[cliTokenSourceCacheKey({ command })]).toBeUndefined();
      expect(runs()).toEqual([[]]);
    });

    it('refresh reports nothing refreshed when no source is in effect, and refuses an unknown name', async () => {
      expect(await refreshCliTokenSource(config)).toEqual({ refreshed: false, reason: 'No token source is in effect.' });
      await expect(refreshCliTokenSource(config, { name: 'missing' })).rejects.toThrow('Unknown token source "missing"');
    });

    it('saves, selects, shows, and clears named sources, leaving other config keys alone', async () => {
      mkdirSync(paths.configDir, { recursive: true });
      writeFileSync(paths.configFilePath, JSON.stringify({ other: { keep: true } }));

      expect(await setCliTokenSource(config, { command: ' cmd-default ' })).toEqual({ saved: true, name: DEFAULT_CLI_TOKEN_SOURCE_NAME, command: 'cmd-default' });
      expect(await setCliTokenSource(config, { command: 'cmd-prod', name: 'prod' })).toMatchObject({ saved: true, name: 'prod', command: 'cmd-prod' });
      expect(await useCliTokenSource(config, 'prod')).toEqual({ activeTokenSource: 'prod', command: 'cmd-prod' });

      const shown = await buildCliTokenSourceShowResult(config);
      expect(shown.sources).toEqual([
        { name: DEFAULT_CLI_TOKEN_SOURCE_NAME, command: 'cmd-default', active: false },
        { name: 'prod', command: 'cmd-prod', active: true }
      ]);
      expect(shown.active).toMatchObject({ command: 'cmd-prod', origin: 'config', name: 'prod' });
      expect(shown.cached).toBeNull();

      expect(await clearCliTokenSource(config, { name: 'prod' })).toEqual({ cleared: true, name: 'prod', command: 'cmd-prod', activeTokenSourceCleared: true });

      const file = JSON.parse(readFileSync(paths.configFilePath, 'utf8')) as Record<string, unknown>;
      expect(file).toEqual({ other: { keep: true }, tokenSource: { command: 'cmd-default' } });
    });

    it('refuses to select a name with no saved source', async () => {
      await expect(useCliTokenSource(config, 'nope')).rejects.toThrow('No token source is saved as "nope"');
    });

    it('rejects a blank command and an invalid name', async () => {
      await expect(setCliTokenSource(config, { command: '   ' })).rejects.toThrow('cannot be empty');
      await expect(setCliTokenSource(config, { command: 'cmd', name: 'dev env' })).rejects.toThrow('Invalid token source name "dev env"');
    });

    it('reports the env vars that win over the saved selection', async () => {
      const envConfig: CliTokenSourceCommandConfig = { ...config, resolver: cliTokenSourceResolver({ cliName: 'test-cli', env: { TEST_CLI_TOKEN_COMMAND: 'env-cmd', TEST_CLI_TOKEN_SOURCE: 'prod' } }) };
      await setCliTokenSource(envConfig, { command: 'cmd-prod', name: 'prod' });

      expect(await setCliTokenSource(envConfig, { command: 'cmd-default' })).toMatchObject({ envOverride: 'env-cmd', envSelection: 'prod' });
      expect(await useCliTokenSource(envConfig, 'default')).toMatchObject({ envOverride: 'env-cmd', envSelection: 'prod' });
      expect((await buildCliTokenSourceShowResult(envConfig)).active).toMatchObject({ command: 'cmd-prod', origin: 'env', name: 'prod' });
    });

    it('reports nothing cleared when no source is saved, and keeps the selection when clearing another source', async () => {
      expect(await clearCliTokenSource(config)).toEqual({ cleared: false, name: DEFAULT_CLI_TOKEN_SOURCE_NAME });

      await setCliTokenSource(config, { command: 'cmd-dev', name: 'dev' });
      await setCliTokenSource(config, { command: 'cmd-prod', name: 'prod' });
      await useCliTokenSource(config, 'prod');
      await clearCliTokenSource(config, { name: 'dev' });

      expect(JSON.parse(readFileSync(paths.configFilePath, 'utf8'))).toEqual({ tokenSources: { prod: { command: 'cmd-prod' } }, activeTokenSource: 'prod' });
    });

    it('shows the --token-source selection, and an unknown selection as an error instead of failing', async () => {
      await setCliTokenSource(config, { command: 'cmd-default' });
      await setCliTokenSource(config, { command: 'cmd-dev', name: 'dev' });

      expect((await buildCliTokenSourceShowResult(config, { tokenSourceName: 'dev' })).active).toMatchObject({ name: 'dev', origin: 'flag' });

      const unknown = await buildCliTokenSourceShowResult(config, { tokenSourceName: 'staging' });
      expect(unknown.active).toBeNull();
      expect(unknown.error).toContain('Unknown token source "staging"');
      expect(unknown.suggestion).toContain('Save it with:');
      expect(unknown.sources.map((x) => x.name)).toEqual([DEFAULT_CLI_TOKEN_SOURCE_NAME, 'dev']);
    });

    it("describes the active source's cached token through mapToken and describeCachedToken, never the token", async () => {
      const { command } = bundleCommand(join(home, 'bin'));
      await setCliTokenSource(config, { command });
      await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();

      expect((await buildCliTokenSourceShowResult(config)).cached).toEqual({ expiresAt: expect.any(String), scopes: ['User.Read', 'Mail.Read'], providerType: 'microsoft' });

      const described = await buildCliTokenSourceShowResult({
        ...config,
        mapToken: (token, stored) => ({ ...token, tenantId: (stored?.['extra'] as Record<string, string> | undefined)?.['tenantId'] }),
        describeCachedToken: (token) => ({ tenantId: token.tenantId })
      });

      expect(described.cached).toEqual({ tenantId: 'tenant-1' });
      expect(JSON.stringify(described)).not.toContain(MINTED_ACCESS_TOKEN);
    });

    it("removes the replaced command's cached token", async () => {
      const first = bundleCommand(join(home, 'bin'));
      await setCliTokenSource(config, { command: first.command });
      await createCliTokenSource({ command: first.command, tokenCachePath: paths.tokenCachePath }).loadToken();
      expect(readTokenFile()[cliTokenSourceCacheKey({ command: first.command })]).toBeDefined();

      await setCliTokenSource(config, { command: 'replacement' });
      expect(readTokenFile()[cliTokenSourceCacheKey({ command: first.command })]).toBeUndefined();
    });

    it('builds the block and describes the source through the hooks', async () => {
      interface ModeSource extends CliTokenSourceConfig {
        readonly mode?: string;
      }

      const hooked: CliTokenSourceCommandConfig<ModeSource> = {
        ...(config as unknown as CliTokenSourceCommandConfig<ModeSource>),
        buildBlock: ({ command, options, previous }) => ({ command, mode: (options['mode'] as string) ?? previous?.mode ?? 'a' }),
        describeSource: (source) => ({ mode: source?.mode ?? 'a' })
      };

      expect(await setCliTokenSource(hooked, { command: 'x', options: { mode: 'b' } })).toMatchObject({ mode: 'b' });
      expect(await setCliTokenSource(hooked, { command: 'y' })).toMatchObject({ command: 'y', mode: 'b' });
    });
  });
});
