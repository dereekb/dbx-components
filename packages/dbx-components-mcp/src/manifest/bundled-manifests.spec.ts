import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSemanticTypeManifests } from './loader.js';

const PACKAGE_ROOT = resolve(__dirname, '..', '..');
const MANIFESTS_DIR = resolve(PACKAGE_ROOT, 'manifests');

const BUNDLED_PATHS = {
  util: resolve(MANIFESTS_DIR, 'dereekb-util.semantic-types.mcp.json'),
  model: resolve(MANIFESTS_DIR, 'dereekb-model.semantic-types.mcp.json')
} as const;

describe('bundled @dereekb/* manifests', () => {
  it('loads cleanly through loadSemanticTypeManifests as strict bundled sources', async () => {
    const result = await loadSemanticTypeManifests({
      sources: [
        { origin: 'bundled', path: BUNDLED_PATHS.util },
        { origin: 'bundled', path: BUNDLED_PATHS.model }
      ]
    });

    expect(result.loadedSources).toEqual(['@dereekb/util', '@dereekb/model']);
    expect(result.warnings).toEqual([]);
    // Step 4 ships only the rails — entries get populated in Step 3 as types
    // gain `@semanticType` JSDoc tags. Asserting a non-zero count would
    // couple this spec to Step 3 progress, so we just prove the pipeline
    // produces a valid registry.
    expect(result.entries.size).toBeGreaterThanOrEqual(0);
  });
});
