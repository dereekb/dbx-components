import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ManifestReadFile } from './loader.js';
import { loadSemanticTypeRegistry } from './load-registry.js';

const PACKAGE_ROOT = resolve(__dirname, '..', '..');
const BUNDLED_UTIL = resolve(PACKAGE_ROOT, 'manifests', 'dereekb-util.semantic-types.mcp.generated.json');
const BUNDLED_MODEL = resolve(PACKAGE_ROOT, 'manifests', 'dereekb-model.semantic-types.mcp.generated.json');

const FAKE_BUNDLED_PATHS = [BUNDLED_UTIL, BUNDLED_MODEL] as const;

const VALID_BUNDLED_UTIL = JSON.stringify({
  version: 1,
  source: '@dereekb/util',
  topicNamespace: 'dereekb-util',
  generatedAt: '1970-01-01T00:00:00.000Z',
  generator: 'test',
  topics: [],
  entries: []
});

const VALID_BUNDLED_MODEL = JSON.stringify({
  version: 1,
  source: '@dereekb/model',
  topicNamespace: 'dereekb-model',
  generatedAt: '1970-01-01T00:00:00.000Z',
  generator: 'test',
  topics: [],
  entries: []
});

function makeReader(files: Record<string, string>): ManifestReadFile {
  return async (path) => {
    const content = files[path];
    if (content === undefined) {
      throw new Error(`fixture: no entry for ${path}`);
    }
    return content;
  };
}

describe('loadSemanticTypeRegistry', () => {
  it('returns an empty registry when no bundled paths and no config exist', async () => {
    const result = await loadSemanticTypeRegistry({
      cwd: '/tmp/no-config',
      bundledManifestPaths: () => [],
      readFile: makeReader({})
    });
    expect(result.registry.loadedSources).toEqual([]);
    expect(result.registry.all).toEqual([]);
    expect(result.configPath).toBe(null);
    expect(result.externalSourceCount).toBe(0);
  });

  it('loads bundled manifests as strict sources', async () => {
    const result = await loadSemanticTypeRegistry({
      cwd: '/tmp/no-config',
      bundledManifestPaths: () => [...FAKE_BUNDLED_PATHS],
      readFile: makeReader({
        [BUNDLED_UTIL]: VALID_BUNDLED_UTIL,
        [BUNDLED_MODEL]: VALID_BUNDLED_MODEL
      })
    });
    expect(result.registry.loadedSources).toEqual(['@dereekb/util', '@dereekb/model']);
    expect(result.loaderWarnings).toEqual([]);
    expect(result.externalSourceCount).toBe(0);
  });

  it('throws when a bundled manifest is malformed (strict source)', async () => {
    await expect(
      loadSemanticTypeRegistry({
        cwd: '/tmp/no-config',
        bundledManifestPaths: () => [BUNDLED_UTIL],
        readFile: makeReader({ [BUNDLED_UTIL]: '{ not-json' })
      })
    ).rejects.toThrow(/strict source failed/);
  });

  it('resolves external manifest paths from dbx-mcp.config.json relative to the config dir', async () => {
    const cwd = '/tmp/workspace';
    const configPath = `${cwd}/dbx-mcp.config.json`;
    const externalPath = `${cwd}/apps/demo/semantic-types.mcp.json`;
    const externalManifest = JSON.stringify({
      version: 1,
      source: 'demo-app',
      topicNamespace: 'demo',
      generatedAt: '1970-01-01T00:00:00.000Z',
      generator: 'test',
      topics: [],
      entries: []
    });
    const result = await loadSemanticTypeRegistry({
      cwd,
      bundledManifestPaths: () => [BUNDLED_UTIL],
      readFile: makeReader({
        [configPath]: JSON.stringify({ version: 1, semanticTypes: { sources: ['apps/demo/semantic-types.mcp.json'] } }),
        [BUNDLED_UTIL]: VALID_BUNDLED_UTIL,
        [externalPath]: externalManifest
      })
    });
    expect(result.configPath).toBe(configPath);
    expect(result.externalSourceCount).toBe(1);
    expect(result.registry.loadedSources).toEqual(['@dereekb/util', 'demo-app']);
  });

  it('warns-and-skips when an external manifest is missing (non-strict)', async () => {
    const cwd = '/tmp/workspace';
    const configPath = `${cwd}/dbx-mcp.config.json`;
    const result = await loadSemanticTypeRegistry({
      cwd,
      bundledManifestPaths: () => [BUNDLED_UTIL],
      readFile: makeReader({
        [configPath]: JSON.stringify({ version: 1, semanticTypes: { sources: ['missing.json'] } }),
        [BUNDLED_UTIL]: VALID_BUNDLED_UTIL
      })
    });
    expect(result.registry.loadedSources).toEqual(['@dereekb/util']);
    expect(result.loaderWarnings.map((w) => w.kind)).toContain('manifest-missing');
  });

  it('returns an empty registry plus config warning when dbx-mcp.config.json is malformed', async () => {
    const cwd = '/tmp/workspace';
    const configPath = `${cwd}/dbx-mcp.config.json`;
    const result = await loadSemanticTypeRegistry({
      cwd,
      bundledManifestPaths: () => [],
      readFile: makeReader({ [configPath]: '{ broken' })
    });
    // findAndLoadConfig returns the discovered path even when parse fails so
    // operators can see which file blew up.
    expect(result.configPath).toBe(configPath);
    expect(result.configWarnings.map((w) => w.kind)).toContain('config-parse-failed');
    expect(result.registry.all).toEqual([]);
  });
});
