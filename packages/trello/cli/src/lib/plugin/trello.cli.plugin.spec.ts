import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureCliOutputWriter } from '@dereekb/dbx-cli';
import { fakeTrelloContext } from '@dereekb/trello';
import { runTrelloCli, type RunTrelloCliConfig } from '../cli';
import { TRELLO_CLI_CONFIG_DIR_ENV_VAR } from '../config/cli.config';
import { createTrelloCliContext } from '../context/cli.context';
import { type TrelloCliPlugin, type TrelloCliPluginApi, createTrelloCliPluginApi, defineTrelloCliPlugin, readTrelloCliVersion, trelloCliPluginContributionError } from './trello.cli.plugin';

describe('trello-cli plugins', () => {
  let dir: string;
  let configDir: string;
  let lines: string[];
  let exitCodes: number[];
  let stderr: string[];
  let setupApis: TrelloCliPluginApi[];

  const fixture = defineTrelloCliPlugin({
    apiVersion: 1,
    name: 'fixture',
    version: '1.2.3',
    describe: 'A fixture plugin',
    setup: (api) => {
      setupApis.push(api);
      return {
        commands: [{ command: 'hello', describe: 'Say hello', requires: 'none', handler: (_argv, ctx) => ctx.output.result({ hello: api.pluginName, stateDir: ctx.stateDir() }) }],
        doctorChecks: [() => ({ name: 'ready', status: 'pass', message: 'the fixture is ready' })]
      };
    }
  });

  const brokenSetup: TrelloCliPlugin = {
    apiVersion: 1,
    name: 'broken',
    setup: () => {
      throw new Error('setup exploded');
    }
  };

  const shadowsBoard: TrelloCliPlugin = { apiVersion: 1, name: 'board', setup: () => ({ commands: [] }) };

  async function run(args: string[], config: Omit<RunTrelloCliConfig, 'argv'> = {}) {
    lines = [];
    exitCodes = [];
    await runTrelloCli({ argv: args, env: { [TRELLO_CLI_CONFIG_DIR_ENV_VAR]: configDir, TRELLO_API_KEY: '', TRELLO_API_TOKEN: '' }, loadExternalPlugins: false, ...config });
    const last = lines.at(-1);
    return { json: last ? (JSON.parse(last) as Record<string, any>) : undefined, exitCode: exitCodes[0] ?? 0 };
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'trello-cli-plugin-'));
    configDir = join(dir, 'config');
    stderr = [];
    setupApis = [];
    vi.stubEnv(TRELLO_CLI_CONFIG_DIR_ENV_VAR, configDir);
    vi.stubEnv('TRELLO_API_KEY', '');
    vi.stubEnv('TRELLO_API_TOKEN', '');
    configureCliOutputWriter((line) => lines.push(line));
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitCodes.push(code ?? 0);
    }) as never);
    vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string) => {
      stderr.push(String(chunk));
      return true;
    }) as never);
  });

  afterEach(() => {
    configureCliOutputWriter(undefined);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  describe('runTrelloCli({ plugins })', () => {
    it('should mount a host plugin under its name, with its own state directory', async () => {
      const result = await run(['fixture', 'hello'], { plugins: [fixture] });

      expect(result.exitCode).toBe(0);
      expect(result.json?.['data']).toEqual({ hello: 'fixture', stateDir: join(configDir, 'state', 'fixture') });
      expect(result.json?.['meta']).toBeUndefined();
      expect(setupApis[0]).toMatchObject({ apiVersion: 1, cliName: 'trello-cli', pluginName: 'fixture', source: 'host', options: {} });
      expect(setupApis[0].hostVersion).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should skip a plugin named like a built-in command with a warning, and keep the built-in', async () => {
      const result = await run(['card', 'ref', 'AbCd1234'], { plugins: [shadowsBoard] });

      expect(result.exitCode).toBe(0);
      expect(result.json?.['data']['ref']).toBe('AbCd1234');
      expect(result.json?.['meta']['warnings']).toEqual([expect.stringContaining('board')]);
      expect(stderr.join('')).toContain('board');
    });

    it('should turn a throwing setup into a meta.warnings entry while the core commands keep working', async () => {
      const result = await run(['card', 'ref', 'AbCd1234'], { plugins: [brokenSetup, fixture] });

      expect(result.exitCode).toBe(0);
      expect(result.json?.['meta']['warnings']).toEqual([expect.stringContaining('setup exploded')]);

      const hello = await run(['fixture', 'hello'], { plugins: [brokenSetup, fixture] });

      expect(hello.json?.['data']['hello']).toBe('fixture');
    });

    it('should stop with PLUGIN_LOAD_FAILED and exit 1 under strictPlugins', async () => {
      const result = await run(['card', 'ref', 'AbCd1234'], { plugins: [brokenSetup], strictPlugins: true });

      expect(result.exitCode).toBe(1);
      expect(result.json).toMatchObject({ ok: false, code: 'PLUGIN_LOAD_FAILED' });
      expect(result.json?.['data']['plugins']).toEqual([expect.objectContaining({ name: 'broken', status: 'failed', step: 'setup' })]);
    });

    it('should skip a plugin that needs a newer host', async () => {
      const result = await run(['extensions'], { plugins: [{ ...fixture, minHostVersion: '999.0.0' }] });

      expect(result.json?.['data']['plugins']).toEqual([expect.objectContaining({ name: 'fixture', status: 'skipped', step: 'version' })]);
    });

    it('should list every plugin with extensions', async () => {
      const result = await run(['extensions'], { plugins: [fixture, brokenSetup] });

      expect(result.exitCode).toBe(0);
      expect(result.json?.['data']).toEqual({
        externalDisabled: true,
        plugins: [expect.objectContaining({ source: 'host', name: 'fixture', version: '1.2.3', status: 'loaded', commands: ['hello'] }), expect.objectContaining({ source: 'host', name: 'broken', status: 'failed', step: 'setup', message: 'setup exploded' })]
      });
    });

    it("should run each plugin's doctor checks and report the plugins", async () => {
      const fake = fakeTrelloContext({ routes: { 'GET /members/me': { id: 'member-1', username: 'alice' }, 'GET /boards/board-1': { id: 'board-1', name: 'Board' } } });
      const result = await run(['doctor'], {
        plugins: [fixture],
        contextProvider: async (request) => createTrelloCliContext({ trelloContext: fake.trelloContext, auth: { mode: 'host', source: 'spec' }, board: 'board-1', configDir, stateName: request.pluginName })
      });

      expect(result.exitCode).toBe(0);
      expect(result.json?.['data']['ok']).toBe(true);
      expect(result.json?.['data']['checks']).toContainEqual({ name: 'fixture:ready', status: 'pass', message: 'the fixture is ready' });
      expect(result.json?.['data']['plugins']).toEqual([expect.objectContaining({ name: 'fixture', status: 'loaded' })]);
    });
  });

  describe('trelloCliPluginContributionError()', () => {
    it('should accept an empty or valid contribution', () => {
      expect(trelloCliPluginContributionError(undefined)).toBeUndefined();
      expect(trelloCliPluginContributionError({ commands: [{ command: 'a <x>', describe: 'A' }], doctorChecks: [() => []] })).toBeUndefined();
    });

    it('should reject malformed contributions', () => {
      expect(trelloCliPluginContributionError('nope')).toContain('object');
      expect(trelloCliPluginContributionError({ commands: {} })).toContain('array');
      expect(trelloCliPluginContributionError({ doctorChecks: ['x'] })).toContain('functions');
      expect(trelloCliPluginContributionError({ commands: [{ command: '', describe: 'A' }] })).toContain('`command`');
      expect(
        trelloCliPluginContributionError({
          commands: [
            { command: 'a', describe: 'A' },
            { command: 'a <x>', describe: 'B' }
          ]
        })
      ).toContain('"a"');
    });
  });

  describe('createTrelloCliPluginApi()', () => {
    it("should prefix the plugin's log lines and duck-type Trello server errors", () => {
      const logged: string[] = [];
      const api = createTrelloCliPluginApi({ plugin: { name: 'fixture' }, source: 'flag', path: '/x/fixture.mjs', options: { a: 1 }, cliName: 'trello-cli', hostVersion: '1.0.0', log: (line) => logged.push(line) });

      api.log('hello');

      expect(logged).toEqual(['[fixture] hello']);
      expect(api).toMatchObject({ pluginName: 'fixture', source: 'flag', path: '/x/fixture.mjs', options: { a: 1 } });
      expect(api.isTrelloServerError(new Error('plain'))).toBe(false);
    });
  });

  describe('readTrelloCliVersion()', () => {
    it('should read the version of the nearest @dereekb/trello package.json', () => {
      expect(readTrelloCliVersion()).toMatch(/^\d+\.\d+\.\d+/);
      expect(readTrelloCliVersion('file:///nowhere/at/all/x.js')).toBeUndefined();
    });
  });
});
