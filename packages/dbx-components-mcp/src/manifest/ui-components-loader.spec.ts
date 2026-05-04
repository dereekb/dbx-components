import { describe, expect, it } from 'vitest';
import { loadUiComponentManifests, type UiComponentManifestReadFile, type UiComponentManifestSource } from './ui-components-loader.js';
import type { UiComponentManifest } from './ui-components-schema.js';

function readFileFromMap(map: Map<string, string>): UiComponentManifestReadFile {
  return async (path) => {
    const value = map.get(path);
    if (value === undefined) {
      throw new Error(`unknown path ${path}`);
    }
    return value;
  };
}

function manifest(overrides: Partial<UiComponentManifest> = {}): UiComponentManifest {
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

describe('loadUiComponentManifests', () => {
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
              slug: 'section',
              category: 'layout',
              kind: 'component',
              selector: 'dbx-section',
              className: 'DbxSectionComponent',
              module: '@dereekb/dbx-web',
              description: 'Section.',
              inputs: [],
              outputs: []
            }
          ]
        })
      )
    );
    const sources: UiComponentManifestSource[] = [{ origin: 'bundled', path: '/m/a.json' }];

    const result = await loadUiComponentManifests({ sources, readFile: readFileFromMap(map) });
    expect(result.entries.size).toBe(1);
    expect(result.loadedSources).toEqual(['a']);
    expect(result.warnings).toEqual([]);
    expect(result.categoryIndex.get('layout')).toEqual(['@dereekb/dbx-web::section']);
  });

  it('warns and skips a non-strict external manifest with bad JSON', async () => {
    const map = new Map<string, string>();
    map.set('/m/a.json', JSON.stringify(manifest({ source: 'a' })));
    map.set('/m/bad.json', '{ not json');
    const sources: UiComponentManifestSource[] = [
      { origin: 'bundled', path: '/m/a.json' },
      { origin: 'external', path: '/m/bad.json' }
    ];

    const result = await loadUiComponentManifests({ sources, readFile: readFileFromMap(map) });
    expect(result.warnings.map((w) => w.kind)).toEqual(['manifest-parse-failed']);
    expect(result.loadedSources).toEqual(['a']);
  });

  it('throws when a strict source fails', async () => {
    const map = new Map<string, string>();
    map.set('/m/a.json', '{ not json');
    const sources: UiComponentManifestSource[] = [{ origin: 'bundled', path: '/m/a.json' }];

    await expect(loadUiComponentManifests({ sources, readFile: readFileFromMap(map) })).rejects.toThrow(/strict source failed/);
  });

  it('throws when zero manifests load successfully', async () => {
    const map = new Map<string, string>();
    map.set('/m/bad.json', '{ not json');
    const sources: UiComponentManifestSource[] = [{ origin: 'external', path: '/m/bad.json' }];

    await expect(loadUiComponentManifests({ sources, readFile: readFileFromMap(map) })).rejects.toThrow(/zero manifests/);
  });

  it('detects entry collisions when two sources declare the same module::slug', async () => {
    const baseEntry = {
      slug: 'section',
      category: 'layout' as const,
      kind: 'component' as const,
      selector: 'dbx-section',
      className: 'DbxSectionComponent',
      module: '@dereekb/dbx-web',
      description: '',
      inputs: [],
      outputs: []
    };
    const map = new Map<string, string>();
    map.set('/m/a.json', JSON.stringify(manifest({ source: 'a', module: '@dereekb/dbx-web', entries: [baseEntry] })));
    map.set('/m/b.json', JSON.stringify(manifest({ source: 'b', module: '@dereekb/dbx-web', entries: [baseEntry] })));
    const sources: UiComponentManifestSource[] = [
      { origin: 'bundled', path: '/m/a.json' },
      { origin: 'bundled', path: '/m/b.json' }
    ];

    const result = await loadUiComponentManifests({ sources, readFile: readFileFromMap(map) });
    expect(result.warnings.find((w) => w.kind === 'entry-collision')).toBeDefined();
  });
});
