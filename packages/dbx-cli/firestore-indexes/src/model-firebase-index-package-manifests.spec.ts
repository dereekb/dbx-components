/**
 * Vitest specs for the pre-built model-firebase-index manifest loader.
 *
 * This loader is the path by which a downstream app derives the framework
 * models' Firestore indexes without a scannable copy of `@dereekb/*` source, so
 * the cases that matter are the ones where a manifest silently fails to load —
 * a dropped manifest means a dropped index, and a dropped index means a broken
 * query in production. Every failure therefore has to surface as an explicit
 * outcome rather than an empty result.
 *
 * Covers:
 *  - explicit `--manifest` paths resolve against cwd and validate
 *  - bundled discovery matches on the filename suffix, sorted for determinism
 *  - a missing bundling package is an explicit outcome, not silence
 *  - an unreadable / unparseable / schema-invalid manifest is reported by path
 *  - an unreadable bundled DIRECTORY yields no paths (a package may legitimately
 *    ship none) — distinct from the package being absent entirely
 */

import { describe, expect, it } from 'vitest';
import { formatModelFirebaseIndexPackageManifestFailure, loadModelFirebaseIndexPackageManifests, MODEL_FIREBASE_INDEX_MANIFEST_FILENAME_SUFFIX, type LoadModelFirebaseIndexPackageManifestsOutcome } from './model-firebase-index-package-manifests.js';
import type { ModelFirebaseIndexManifest } from './model-firebase-index-schema.js';

const CWD = '/workspace';
const BUNDLED_DIR = '/workspace/node_modules/@dereekb/dbx-components-mcp/generated';

function makeManifest(input: { readonly source: string; readonly slugs?: readonly string[] }): ModelFirebaseIndexManifest {
  return {
    version: 1,
    source: input.source,
    module: input.source,
    generatedAt: '1970-01-01T00:00:00.000Z',
    generator: 'spec',
    entries: (input.slugs ?? []).map((slug) => ({
      slug,
      name: slug,
      module: input.source,
      subpath: 'lib/fake',
      signature: '',
      description: '',
      model: 'FakeModel',
      collection: 'fake',
      isNested: false,
      scope: 'COLLECTION' as const,
      manual: false,
      skip: false,
      category: 'query',
      params: [],
      returns: '',
      tags: [],
      constraintSequences: [],
      derivedComposites: [],
      derivedFieldOverrides: [],
      example: ''
    }))
  };
}

function makeReadFile(files: Readonly<Record<string, string>>) {
  return async (path: string): Promise<string> => {
    const contents = files[path];
    if (contents === undefined) {
      const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${path}'`);
      err.code = 'ENOENT';
      throw err;
    }
    return contents;
  };
}

function expectSuccess(outcome: LoadModelFirebaseIndexPackageManifestsOutcome) {
  if (outcome.kind !== 'success') {
    throw new Error(`expected success, got ${outcome.kind}`);
  }
  return outcome;
}

describe('loadModelFirebaseIndexPackageManifests()', () => {
  describe('explicit manifest paths', () => {
    it('resolves a relative path against cwd and returns the validated manifest', async () => {
      const manifest = makeManifest({ source: '@dereekb/firebase', slugs: ['notificationsPastSendAtTimeQuery'] });
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        manifestPaths: ['manifests/a.json'],
        readFile: makeReadFile({ '/workspace/manifests/a.json': JSON.stringify(manifest) })
      });

      const success = expectSuccess(outcome);
      expect(success.loaded).toHaveLength(1);
      expect(success.loaded[0].path).toBe('/workspace/manifests/a.json');
      expect(success.loaded[0].manifest.entries[0].slug).toBe('notificationsPastSendAtTimeQuery');
    });

    it('preserves the order the paths were given in', async () => {
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        manifestPaths: ['/b.json', '/a.json'],
        readFile: makeReadFile({
          '/a.json': JSON.stringify(makeManifest({ source: 'a' })),
          '/b.json': JSON.stringify(makeManifest({ source: 'b' }))
        })
      });

      expect(expectSuccess(outcome).loaded.map((l) => l.manifest.source)).toEqual(['b', 'a']);
    });

    it('reports an unreadable manifest by path rather than skipping it', async () => {
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        manifestPaths: ['/missing.json'],
        readFile: makeReadFile({})
      });

      expect(outcome.kind).toBe('unreadable-manifest');
      expect(outcome.kind === 'unreadable-manifest' && outcome.path).toBe('/missing.json');
    });

    it('reports unparseable JSON as invalid-manifest', async () => {
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        manifestPaths: ['/bad.json'],
        readFile: makeReadFile({ '/bad.json': '{ not json' })
      });

      expect(outcome.kind).toBe('invalid-manifest');
      expect(outcome.kind === 'invalid-manifest' && outcome.path).toBe('/bad.json');
    });

    it('reports a schema-invalid manifest as invalid-manifest', async () => {
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        manifestPaths: ['/wrong.json'],
        readFile: makeReadFile({ '/wrong.json': JSON.stringify({ version: 1, source: 'x' }) })
      });

      expect(outcome.kind).toBe('invalid-manifest');
      expect(outcome.kind === 'invalid-manifest' && outcome.error.length).toBeGreaterThan(0);
    });
  });

  describe('bundled discovery', () => {
    const bundledFiles = {
      [`${BUNDLED_DIR}/dereekb-firebase${MODEL_FIREBASE_INDEX_MANIFEST_FILENAME_SUFFIX}`]: JSON.stringify(makeManifest({ source: '@dereekb/firebase' })),
      [`${BUNDLED_DIR}/dereekb-openrouter${MODEL_FIREBASE_INDEX_MANIFEST_FILENAME_SUFFIX}`]: JSON.stringify(makeManifest({ source: '@dereekb/openrouter' }))
    };

    it('loads every suffix-matching manifest, sorted for a deterministic merge order', async () => {
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        discoverBundled: true,
        resolveBundledDirectory: () => BUNDLED_DIR,
        readDir: async () => [
          // deliberately unsorted, and salted with the sibling pipelines' manifests
          `dereekb-openrouter${MODEL_FIREBASE_INDEX_MANIFEST_FILENAME_SUFFIX}`,
          'dereekb-firebase.model-snapshot-fields.mcp.generated.json',
          'dereekb-util.utils.mcp.generated.json',
          `dereekb-firebase${MODEL_FIREBASE_INDEX_MANIFEST_FILENAME_SUFFIX}`
        ],
        readFile: makeReadFile(bundledFiles)
      });

      expect(expectSuccess(outcome).loaded.map((l) => l.manifest.source)).toEqual(['@dereekb/firebase', '@dereekb/openrouter']);
    });

    it('places explicit manifests ahead of discovered ones', async () => {
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        manifestPaths: ['/local.json'],
        discoverBundled: true,
        resolveBundledDirectory: () => BUNDLED_DIR,
        readDir: async () => [`dereekb-firebase${MODEL_FIREBASE_INDEX_MANIFEST_FILENAME_SUFFIX}`],
        readFile: makeReadFile({ '/local.json': JSON.stringify(makeManifest({ source: 'local' })), ...bundledFiles })
      });

      expect(expectSuccess(outcome).loaded.map((l) => l.manifest.source)).toEqual(['local', '@dereekb/firebase']);
    });

    it('reports an explicit outcome when the bundling package is not installed', async () => {
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        discoverBundled: true,
        resolveBundledDirectory: () => null,
        readFile: makeReadFile({})
      });

      expect(outcome.kind).toBe('no-bundled-package');
      expect(outcome.kind === 'no-bundled-package' && outcome.packageName).toBe('@dereekb/dbx-components-mcp');
    });

    it('treats an unreadable bundled directory as no manifests, not as a failure', async () => {
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        discoverBundled: true,
        resolveBundledDirectory: () => BUNDLED_DIR,
        readDir: async () => {
          throw new Error('ENOENT');
        },
        readFile: makeReadFile({})
      });

      expect(expectSuccess(outcome).loaded).toHaveLength(0);
    });

    it('does not read anything when discovery is off and no paths are given', async () => {
      const outcome = await loadModelFirebaseIndexPackageManifests({
        cwd: CWD,
        readFile: async () => {
          throw new Error('should not be called');
        }
      });

      expect(expectSuccess(outcome).loaded).toHaveLength(0);
    });
  });
});

describe('formatModelFirebaseIndexPackageManifestFailure()', () => {
  it('names the offending path for a read failure', () => {
    const message = formatModelFirebaseIndexPackageManifestFailure({ kind: 'unreadable-manifest', path: '/x.json', error: 'ENOENT' });
    expect(message).toContain('/x.json');
    expect(message).toContain('ENOENT');
  });

  it('names the offending path for a validation failure', () => {
    const message = formatModelFirebaseIndexPackageManifestFailure({ kind: 'invalid-manifest', path: '/y.json', error: 'entries must be an array' });
    expect(message).toContain('/y.json');
    expect(message).toContain('entries must be an array');
  });

  it('tells the user how to recover from a missing bundling package', () => {
    const message = formatModelFirebaseIndexPackageManifestFailure({ kind: 'no-bundled-package', packageName: '@dereekb/dbx-components-mcp' });
    expect(message).toContain('@dereekb/dbx-components-mcp');
    expect(message).toContain('--manifest');
  });
});
