import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MS_IN_HOUR, MS_IN_MINUTE } from '@dereekb/util';
import { buildCliPaths, type CliPaths } from '../config/paths';
import { DBX_CLI_CREDENTIAL_PROCESS_ENV_VAR } from '../util/credential-process';
import { type CliTokenSourceBundle, cliTokenSourceCacheKey, cliTokenSourceReport, cliTokenSourceRunCommand, cliTokenSourceTokenFromBundle, createCliTokenSource, loadCliTokenSourceStatus } from './token-source';
import { type CliTokenSourceConfig, cliTokenSourceEnvVarNames, cliTokenSourceResolver, DEFAULT_CLI_TOKEN_SOURCE_NAME } from './token-source.config';
import { buildCliTokenSourceShowResult, clearCliTokenSource, cliTokenSourceJsonConfigStore, type CliTokenSourceCommandConfig, setCliTokenSource, useCliTokenSource } from './token-source.command';

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
 * With `--scopes "<scopes>"`, the bundle's scopes are the requested ones (a narrowed mint).
 *
 * @param dir - Where to write the script.
 * @param bundle - Overrides merged over the default bundle.
 * @param failWith - When set, the script prints a dbx-cli error envelope with this message instead.
 * @returns The command and its run log.
 */
function bundleCommand(dir: string, bundle: Partial<CliTokenSourceBundle> = {}, failWith?: string): BundleCommand {
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
if (failWith) {
  process.stdout.write(JSON.stringify({ ok: false, error: failWith, code: 'NOT_LOGGED_IN' }));
  process.exit(1);
}
const bundle = ${JSON.stringify(fullBundle)};
const scopesIndex = args.indexOf('--scopes');
if (scopesIndex >= 0) {
  bundle.scopes = args[scopesIndex + 1].split(' ');
}
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
      expect(() => resolver.resolveActiveTokenSource(fileConfig, { tokenSourceName: 'nope' })).toThrow('Unknown token source "nope" (from --token-source). Saved token sources: default, prod. Save it with: test-cli auth token-source set "<command>" --name nope');
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

  describe('cliTokenSourceCacheKey()', () => {
    it('hashes the command alone without scopes', () => {
      expect(cliTokenSourceCacheKey({ command: 'a' })).toBe(cliTokenSourceCacheKey({ command: 'a', scopes: [] }));
    });

    it('keys a narrowed request apart from the unnarrowed one, independent of scope order', () => {
      const narrowed = cliTokenSourceCacheKey({ command: 'a', scopes: ['Mail.Read', 'User.Read'] });
      expect(narrowed).not.toBe(cliTokenSourceCacheKey({ command: 'a' }));
      expect(narrowed).toBe(cliTokenSourceCacheKey({ command: 'a', scopes: ['User.Read', 'Mail.Read', 'User.Read'] }));
      expect(narrowed).not.toBe(cliTokenSourceCacheKey({ command: 'a', scopes: ['User.Read'] }));
    });

    it('refuses a scope that is unsafe to append to a shell command', () => {
      expect(() => cliTokenSourceRunCommand({ command: 'a', scopes: ['User.Read"; rm -rf ~'] })).toThrow('Invalid scope');
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

    it('appends --scopes and caches the narrowed token under its own key', async () => {
      const { command, runs } = bundleCommand(join(home, 'bin'));
      const narrowed = await createCliTokenSource({ command, scopes: ['User.Read'], tokenCachePath: paths.tokenCachePath }).loadToken();
      const wider = await createCliTokenSource({ command, tokenCachePath: paths.tokenCachePath }).loadToken();

      expect(narrowed.scopes).toEqual(['User.Read']);
      expect(wider.scopes).toEqual(['User.Read', 'Mail.Read']);
      expect(runs()).toEqual([['--scopes', 'User.Read'], []]);

      // the narrowed token is reused only for the same narrowed request
      await createCliTokenSource({ command, scopes: ['User.Read'], tokenCachePath: paths.tokenCachePath }).loadToken();
      expect(runs().length).toBe(2);
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
      expect(cliTokenSourceReport(status!)).toEqual({ command, origin: 'config', name: DEFAULT_CLI_TOKEN_SOURCE_NAME, error: status?.error });
    });

    it('reports the loaded token without the access token', async () => {
      const { command } = bundleCommand(join(home, 'bin'));
      const resolver = cliTokenSourceResolver({ cliName: 'test-cli', env: {} });
      const status = await loadCliTokenSourceStatus({ resolver, fileConfig: { tokenSource: { command } }, tokenCachePath: paths.tokenCachePath, scopes: ['User.Read'] });
      const report = cliTokenSourceReport(status!);

      expect(report).toMatchObject({ requestedScopes: ['User.Read'], scopes: ['User.Read'], providerType: 'microsoft' });
      expect(JSON.stringify(report)).not.toContain(MINTED_ACCESS_TOKEN);
    });
  });

  describe('auth token-source functions', () => {
    let config: CliTokenSourceCommandConfig;

    beforeEach(() => {
      config = { resolver: cliTokenSourceResolver({ cliName: 'test-cli', env: {} }), tokenCachePath: paths.tokenCachePath, ...cliTokenSourceJsonConfigStore(paths) };
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
