import { describe, expect, it } from 'vitest';
import type { ConfigReadFile } from '../config/load-config.js';
import { loadTokenRegistry } from './load-tokens-registry.js';

function readFromMap(map: Map<string, string>): ConfigReadFile {
  return async (path) => {
    const value = map.get(path);
    if (value === undefined) {
      throw new Error(`unknown path ${path}`);
    }
    return value;
  };
}

const VALID_BUNDLED_MANIFEST = JSON.stringify({
  version: 1,
  source: 'dereekb-dbx-web',
  module: '@dereekb/dbx-web',
  generatedAt: '2025-01-01T00:00:00Z',
  generator: 'test',
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
});

describe('loadTokenRegistry', () => {
  it('loads bundled manifests via the injected factory and reads no config', async () => {
    const map = new Map<string, string>();
    map.set('/bundled/a.json', VALID_BUNDLED_MANIFEST);
    const result = await loadTokenRegistry({
      cwd: '/workspace',
      bundledManifestPaths: () => ['/bundled/a.json'],
      readFile: readFromMap(map)
    });
    expect(result.registry.all.length).toBe(1);
    expect(result.externalSourceCount).toBe(0);
  });

  it('honors tokens.scan[].out paths from dbx-mcp.config.json', async () => {
    const map = new Map<string, string>();
    map.set('/bundled/a.json', VALID_BUNDLED_MANIFEST);
    map.set(
      '/workspace/dbx-mcp.config.json',
      JSON.stringify({
        version: 1,
        tokens: {
          scan: [{ project: 'apps/x', source: 'app-x', module: '@app/x', include: ['src/**/*.scss'], out: 'apps/x/.dbx-mcp/tokens.json' }]
        }
      })
    );
    map.set(
      '/workspace/apps/x/.dbx-mcp/tokens.json',
      JSON.stringify({
        version: 1,
        source: 'app-x',
        module: '@app/x',
        generatedAt: '2025-01-01T00:00:00Z',
        generator: 'test',
        entries: [
          {
            cssVariable: '--app-x-onboarding-bg',
            source: 'app',
            role: 'color',
            intents: ['onboarding background'],
            description: 'project-local',
            defaults: { light: '#26353f' }
          }
        ]
      })
    );
    const result = await loadTokenRegistry({
      cwd: '/workspace',
      bundledManifestPaths: () => ['/bundled/a.json'],
      readFile: readFromMap(map)
    });
    expect(result.externalSourceCount).toBe(1);
    expect(result.registry.findByCssVariable('--app-x-onboarding-bg')).toBeDefined();
  });
});
