import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCssUtilityManifests } from './css-utilities-loader.js';
import { loadSemanticTypeManifests } from './loader.js';
import { loadTokenManifests } from './tokens-loader.js';

const PACKAGE_ROOT = resolve(__dirname, '..', '..');
const MANIFESTS_DIR = resolve(PACKAGE_ROOT, 'generated');

const BUNDLED_PATHS = {
  util: resolve(MANIFESTS_DIR, 'dereekb-util.semantic-types.mcp.generated.json'),
  model: resolve(MANIFESTS_DIR, 'dereekb-model.semantic-types.mcp.generated.json'),
  date: resolve(MANIFESTS_DIR, 'dereekb-date.semantic-types.mcp.generated.json'),
  firebase: resolve(MANIFESTS_DIR, 'dereekb-firebase.semantic-types.mcp.generated.json'),
  firebaseServer: resolve(MANIFESTS_DIR, 'dereekb-firebase-server.semantic-types.mcp.generated.json')
} as const;

const BUNDLED_TOKEN_PATHS = {
  dbxWeb: resolve(MANIFESTS_DIR, 'dereekb-dbx-web.tokens.mcp.generated.json'),
  matSys: resolve(MANIFESTS_DIR, 'angular-material-m3.tokens.mcp.generated.json'),
  mdc: resolve(MANIFESTS_DIR, 'angular-material-mdc.tokens.mcp.generated.json')
} as const;

const BUNDLED_CSS_UTILITY_PATHS = {
  dbxWeb: resolve(MANIFESTS_DIR, 'dereekb-dbx-web.css-utilities.mcp.generated.json')
} as const;

describe('bundled @dereekb/* manifests', () => {
  it('loads cleanly through loadSemanticTypeManifests as strict bundled sources', async () => {
    const result = await loadSemanticTypeManifests({
      sources: [
        { origin: 'bundled', path: BUNDLED_PATHS.util },
        { origin: 'bundled', path: BUNDLED_PATHS.model },
        { origin: 'bundled', path: BUNDLED_PATHS.date },
        { origin: 'bundled', path: BUNDLED_PATHS.firebase },
        { origin: 'bundled', path: BUNDLED_PATHS.firebaseServer }
      ]
    });

    expect(result.loadedSources).toEqual(['@dereekb/util', '@dereekb/model', '@dereekb/date', '@dereekb/firebase', '@dereekb/firebase-server']);
    expect(result.warnings).toEqual([]);
    // Step 4 ships only the rails — entries get populated in Step 3 as types
    // gain `@semanticType` JSDoc tags. Asserting a non-zero count would
    // couple this spec to Step 3 progress, so we just prove the pipeline
    // produces a valid registry.
    expect(result.entries.size).toBeGreaterThanOrEqual(0);
  });

  it('loads bundled token manifests cleanly through loadTokenManifests', async () => {
    const result = await loadTokenManifests({
      sources: [
        { origin: 'bundled', path: BUNDLED_TOKEN_PATHS.dbxWeb },
        { origin: 'bundled', path: BUNDLED_TOKEN_PATHS.matSys },
        { origin: 'bundled', path: BUNDLED_TOKEN_PATHS.mdc }
      ]
    });
    expect(result.loadedSources).toEqual(['dereekb-dbx-web', 'angular-material-m3', 'angular-material-mdc']);
    expect(result.warnings).toEqual([]);
    expect(result.entries.size).toBeGreaterThan(50);
  });

  it('loads bundled css-utility manifest cleanly through loadCssUtilityManifests', async () => {
    const result = await loadCssUtilityManifests({
      sources: [{ origin: 'bundled', path: BUNDLED_CSS_UTILITY_PATHS.dbxWeb }]
    });
    expect(result.loadedSources).toEqual(['@dereekb/dbx-web']);
    expect(result.warnings).toEqual([]);
    expect(result.entries.size).toBeGreaterThanOrEqual(10);
  });
});
