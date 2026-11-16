import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CliPlugin, compareCliVersions, loadCliPlugins, type LoadCliPluginsInput } from './cli.plugin';
import { prescanCliExtensionArgs, resolveCliPluginRef } from './cli.plugin.resolve';
import { createCliJsonStore } from './cli.json.store';
import { createContextSlot } from '../util/context.slot';
import { appendCliOutputWarnings, clearCliOutputWarnings, configureCliOutputWriter, outputResult } from '../util/output';

interface FixtureApi {
  readonly options: Readonly<Record<string, unknown>>;
}

interface FixtureContribution {
  readonly commands: readonly string[];
}

const root = mkdtempSync(join(tmpdir(), 'dbx-cli-plugin-'));
const configDir = join(root, 'config');
const cwd = join(root, 'cwd');
const installDir = join(root, 'install', 'bin');

function plugin(path: string, body: string): string {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body);
  return path;
}

function fixturePlugin(name: string, extra = ''): string {
  return `export default { apiVersion: 1, name: '${name}', version: '1.0.0', setup: (api) => ({ commands: ['${name}-cmd'], options: api.options }) ${extra} };\n`;
}

function packagePlugin(nodeModulesRoot: string, name: string): void {
  plugin(join(nodeModulesRoot, 'node_modules', name, 'package.json'), JSON.stringify({ name, type: 'module', exports: { '.': { import: './index.mjs' } } }));
  plugin(join(nodeModulesRoot, 'node_modules', name, 'index.mjs'), fixturePlugin(name));
}

const alphaPath = plugin(join(configDir, 'plugins', 'alpha.mjs'), fixturePlugin('alpha'));
const betaPath = plugin(join(root, 'abs', 'beta.mjs'), fixturePlugin('beta'));
plugin(join(cwd, 'gamma.mjs'), fixturePlugin('gamma'));
plugin(join(root, 'abs', 'throws.mjs'), `console.log('noise on import');\nthrow new Error('boom on import');\n`);
plugin(join(root, 'abs', 'slow.mjs'), `export default { apiVersion: 1, name: 'slow', setup: () => new Promise((resolve) => setTimeout(() => resolve({ commands: [] }), 5000)) };\n`);
plugin(join(root, 'abs', 'v2.mjs'), `export default { apiVersion: 2, name: 'future', setup: () => ({ commands: [] }) };\n`);
plugin(join(root, 'abs', 'newer-host.mjs'), `export default { apiVersion: 1, name: 'newer', minHostVersion: '99.0.0', setup: () => ({ commands: [] }) };\n`);
plugin(join(root, 'abs', 'board.mjs'), fixturePlugin('board'));
plugin(join(root, 'abs', 'alpha-again.mjs'), fixturePlugin('alpha'));
plugin(join(root, 'abs', 'noisy.mjs'), `console.log('noise on import');\n${fixturePlugin('noisy')}`);
packagePlugin(cwd, 'cwd-only-plugin');
packagePlugin(configDir, 'config-plugin');
packagePlugin(join(root, 'install'), 'install-plugin');

const hostPlugin: CliPlugin<FixtureApi, FixtureContribution> = { apiVersion: 1, name: 'host', setup: () => ({ commands: ['host-cmd'] }) };

function load(overrides: Partial<LoadCliPluginsInput<FixtureApi, FixtureContribution>> = {}) {
  return loadCliPlugins<FixtureApi, FixtureContribution>({ envPrefix: 'FIXTURE_CLI', apiVersion: 1, hostVersion: '1.0.0', configDir, cwd, installDir, env: {}, reservedNames: ['board'], createApi: (_, context) => ({ options: context.options }), log: () => undefined, ...overrides });
}

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('loadCliPlugins()', () => {
  it('loads host, config, env and flag plugins in that order and passes config options', async () => {
    const result = await load({ hostPlugins: [hostPlugin], configExtensions: [{ path: './plugins/alpha.mjs', options: { team: 'a' } }], env: { FIXTURE_CLI_EXTENSIONS: betaPath }, argv: ['card', 'get', '--extension', 'gamma.mjs'] });

    expect(result.report.map((x) => `${x.source}:${x.name}:${x.status}`)).toEqual(['host:host:loaded', 'config:alpha:loaded', 'env:beta:loaded', 'flag:gamma:loaded']);
    expect(result.loaded.find((x) => x.plugin.name === 'alpha')?.contribution).toMatchObject({ options: { team: 'a' } });
    expect(result.loaded[1].report.path).toBe(alphaPath);
    expect(result.warnings).toEqual([]);
  });

  it('loads a module referenced twice once, and fails name clashes', async () => {
    const result = await load({ configExtensions: ['./plugins/alpha.mjs'], env: { FIXTURE_CLI_EXTENSIONS: alphaPath }, argv: ['--extension', join(root, 'abs', 'board.mjs'), `--extension=${join(root, 'abs', 'alpha-again.mjs')}`] });

    expect(result.loaded.map((x) => x.plugin.name)).toEqual(['alpha']);
    expect(result.report.map((x) => `${x.source}:${x.status}:${x.step ?? ''}`)).toEqual(['config:loaded:', 'env:skipped:resolve', 'flag:failed:name', 'flag:failed:name']);
    expect(result.warnings).toHaveLength(2);
  });

  it('isolates a module that throws on import and a setup that never finishes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log');
    const lines: string[] = [];
    const result = await load({ argv: ['--extension', join(root, 'abs', 'throws.mjs'), '--extension', join(root, 'abs', 'slow.mjs'), '--extension', betaPath], setupTimeoutMs: 50, log: (line) => lines.push(line) });

    expect(result.loaded.map((x) => x.plugin.name)).toEqual(['beta']);
    expect(result.report.filter((x) => x.status === 'failed').map((x) => x.step)).toEqual(['import', 'setup']);
    expect(result.report[0].message).toContain('boom on import');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\[fixture-cli\] failed to load plugin/);
    expect(errorSpy).toHaveBeenCalledWith('noise on import');
    expect(logSpy).not.toHaveBeenCalledWith('noise on import');
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('skips an apiVersion mismatch and a plugin that needs a newer host', async () => {
    const result = await load({ argv: ['--extension', join(root, 'abs', 'v2.mjs'), '--extension', join(root, 'abs', 'newer-host.mjs')] });

    expect(result.loaded).toEqual([]);
    expect(result.report.map((x) => `${x.name}:${x.status}:${x.step}`)).toEqual(['future:skipped:version', 'newer:skipped:version']);
  });

  it('resolves package names from the config dir and the install location, never cwd', async () => {
    const result = await load({ argv: ['--extension', 'config-plugin', '--extension', 'install-plugin', '--extension', 'cwd-only-plugin'] });

    expect(result.loaded.map((x) => x.plugin.name)).toEqual(['config-plugin', 'install-plugin']);
    expect(result.report[2]).toMatchObject({ ref: 'cwd-only-plugin', status: 'failed', step: 'resolve' });
  });

  it('refuses a relative path from the env var', () => {
    expect(resolveCliPluginRef({ ref: 'gamma.mjs', source: 'env', cwd })).toMatchObject({ ok: false });
    expect(resolveCliPluginRef({ ref: './gamma.mjs', source: 'flag', cwd })).toEqual({ ok: true, path: join(cwd, 'gamma.mjs') });
  });

  it('turns every external source off with --no-extensions or the env flag', async () => {
    const input = { hostPlugins: [hostPlugin], configExtensions: ['./plugins/alpha.mjs'], env: { FIXTURE_CLI_EXTENSIONS: betaPath } };
    const byFlag = await load({ ...input, argv: ['--no-extensions', '--extension', 'gamma.mjs'] });
    const byEnv = await load({ ...input, env: { ...input.env, FIXTURE_CLI_NO_EXTENSIONS: '1' } });

    for (const result of [byFlag, byEnv]) {
      expect(result.externalDisabled).toBe(true);
      expect(result.loaded.map((x) => x.plugin.name)).toEqual(['host']);
    }
  });

  it('fails a plugin whose mount throws without affecting the next', async () => {
    const result = await load({ argv: ['--extension', alphaPath, '--extension', betaPath], mount: (loaded) => {
      if (loaded.plugin.name === 'alpha') {
        throw new Error('mount failed');
      }
    } });

    expect(result.loaded.map((x) => x.plugin.name)).toEqual(['beta']);
    expect(result.report[0]).toMatchObject({ status: 'failed', step: 'mount', message: 'mount failed' });
  });
});

describe('prescanCliExtensionArgs()', () => {
  it('collects both flag forms and stops at --', () => {
    expect(prescanCliExtensionArgs(['--extension', 'a', '--extension=b', '--no-extensions', '--', '--extension', 'c'])).toEqual({ extensions: ['a', 'b'], noExtensions: true });
  });
});

describe('compareCliVersions()', () => {
  it('compares numerically', () => {
    expect(compareCliVersions('14.25.1', '14.9.0')).toBeGreaterThan(0);
    expect(compareCliVersions('1.0.0-beta', '1.0.0')).toBe(0);
    expect(compareCliVersions('1.2', '1.10.0')).toBeLessThan(0);
  });
});

describe('createCliJsonStore()', () => {
  it('reads nothing, writes atomically, updates and clears', async () => {
    const store = createCliJsonStore<{ count: number }>({ filePath: join(root, 'state', 'nested', 'store.json') });

    expect(await store.read()).toBeUndefined();
    await store.write({ count: 1 });
    expect(await store.update((current) => ({ count: (current?.count ?? 0) + 1 }))).toEqual({ count: 2 });
    expect(await store.read()).toEqual({ count: 2 });
    await store.clear();
    expect(await store.read()).toBeUndefined();
  });
});

describe('createContextSlot() with a globalKey', () => {
  it('shares the value between two slots with the same key', () => {
    const key = `dbx-cli.spec.${Date.now()}`;
    const a = createContextSlot<string>({ globalKey: key });
    const b = createContextSlot<string>({ globalKey: key });
    a.set('shared');
    expect(b.require()).toBe('shared');
    a.set(undefined);
    expect(() => b.require()).toThrow();
  });
});

describe('output writer', () => {
  afterEach(() => {
    configureCliOutputWriter();
    clearCliOutputWarnings();
  });

  it('writes through the configured writer and carries warnings in meta', () => {
    const lines: string[] = [];
    configureCliOutputWriter((line) => lines.push(line));
    appendCliOutputWarnings(['plugin x failed']);
    outputResult({ a: 1 }, { warnings: ['earlier'] });

    expect(JSON.parse(lines[0])).toEqual({ ok: true, data: { a: 1 }, meta: { warnings: ['earlier', 'plugin x failed'] } });
  });
});
