import { describe, expect, it } from 'vitest';
import { loadTokenManifests, type TokenManifestReadFile, type TokenManifestSource } from './tokens-loader.js';
import type { TokenManifest } from './tokens-schema.js';

function readFromMap(map: Map<string, string>): TokenManifestReadFile {
  return async (path) => {
    const value = map.get(path);
    if (value === undefined) {
      throw new Error(`unknown path ${path}`);
    }
    return value;
  };
}

function manifest(overrides: Partial<TokenManifest> = {}): TokenManifest {
  return {
    version: 1,
    source: 'test-source',
    module: '@test/x',
    generatedAt: '2025-01-01T00:00:00Z',
    generator: 'test',
    entries: [],
    ...overrides
  };
}

describe('loadTokenManifests', () => {
  it('loads a single bundled manifest', async () => {
    const map = new Map<string, string>();
    map.set(
      '/m/a.json',
      JSON.stringify(
        manifest({
          source: 'a',
          module: '@dereekb/dbx-web',
          entries: [
            {
              cssVariable: '--dbx-padding-3',
              source: 'dbx-web',
              role: 'spacing',
              intents: ['section gap'],
              description: 'Padding step 3.',
              defaults: { light: '12px' }
            }
          ]
        })
      )
    );
    const sources: TokenManifestSource[] = [{ origin: 'bundled', path: '/m/a.json' }];
    const result = await loadTokenManifests({ sources, readFile: readFromMap(map) });
    expect(result.entries.size).toBe(1);
    expect(result.loadedSources).toEqual(['a']);
    expect(result.warnings).toEqual([]);
  });

  it('warns and skips a non-strict external manifest with bad JSON', async () => {
    const map = new Map<string, string>();
    map.set('/m/a.json', JSON.stringify(manifest({ source: 'a' })));
    map.set('/m/bad.json', '{ not json');
    const sources: TokenManifestSource[] = [
      { origin: 'bundled', path: '/m/a.json' },
      { origin: 'external', path: '/m/bad.json' }
    ];
    const result = await loadTokenManifests({ sources, readFile: readFromMap(map) });
    expect(result.warnings.map((w) => w.kind)).toEqual(['manifest-parse-failed']);
    expect(result.loadedSources).toEqual(['a']);
  });

  it('throws when a strict source fails', async () => {
    const map = new Map<string, string>();
    map.set('/m/a.json', '{ not json');
    const sources: TokenManifestSource[] = [{ origin: 'bundled', path: '/m/a.json' }];
    await expect(loadTokenManifests({ sources, readFile: readFromMap(map) })).rejects.toThrow(/strict source failed/);
  });
});
