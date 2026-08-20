import { describe, expect, it } from 'vitest';
import type { BuildModelFirebaseIndexManifestOutcome } from '../../firestore-indexes/src/model-firebase-index-build-manifest.js';
import { findQueryEntries } from './find-query-entries.js';

function entry(overrides: Record<string, unknown> = {}): any {
  return {
    slug: 'published-guestbooks-query',
    name: 'publishedGuestbooksQuery',
    module: 'demo-firebase',
    subpath: 'model/guestbook/guestbook.query',
    signature: 'publishedGuestbooksQuery(params: P): FirestoreQueryConstraint[]',
    description: 'Query for the published guestbooks.',
    model: 'Guestbook',
    collection: 'gb',
    isNested: false,
    scope: 'COLLECTION',
    manual: false,
    skip: false,
    category: 'listing',
    params: [{ name: 'params', type: 'P', description: 'the params', optional: false }],
    returns: 'FirestoreQueryConstraint[]',
    tags: ['listing'],
    constraintSequences: [],
    derivedComposites: [],
    derivedFieldOverrides: [],
    ...overrides
  };
}

function successOutcome(entries: readonly any[], dispatcherNames: readonly string[] = []): BuildModelFirebaseIndexManifestOutcome {
  return {
    kind: 'success',
    manifest: { entries } as never,
    outPath: 'out.json',
    scannedFileCount: entries.length,
    extractWarnings: [],
    entryFilePathsBySlug: new Map(),
    dispatcherSummaries: dispatcherNames.map((name) => ({ slug: name, name, delegates: [] }))
  };
}

const GENERATOR = 'test@1';

describe('findQueryEntries()', () => {
  it('collects a tagged entry with its params and metadata', async () => {
    const result = await findQueryEntries({ componentRoot: '/c', generator: GENERATOR, buildManifest: async () => successOutcome([entry()]) });

    expect(result.kind).toBe('success');
    if (result.kind !== 'success') return;
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ slug: 'published-guestbooks-query', model: 'Guestbook', collection: 'gb', scope: 'COLLECTION', category: 'listing' });
    expect(result.entries[0].params).toEqual([{ name: 'params', type: 'P', description: 'the params', optional: false }]);
  });

  it('drops @dbxModelFirebaseIndexSpecFilesOnly entries', async () => {
    const result = await findQueryEntries({ componentRoot: '/c', generator: GENERATOR, buildManifest: async () => successOutcome([entry(), entry({ slug: 'spec-only-query', name: 'specOnlyQuery', specOnly: true })]) });

    expect(result.kind).toBe('success');
    if (result.kind !== 'success') return;
    expect(result.entries.map((x) => x.slug)).toEqual(['published-guestbooks-query']);
    expect(result.droppedSpecOnly).toBe(1);
  });

  it('marks a dispatcher-tagged factory', async () => {
    const result = await findQueryEntries({ componentRoot: '/c', generator: GENERATOR, buildManifest: async () => successOutcome([entry()], ['publishedGuestbooksQuery']) });

    expect(result.kind).toBe('success');
    if (result.kind !== 'success') return;
    expect(result.entries[0].dispatcher).toBe(true);
  });

  it('omits absent optional metadata rather than emitting empty values', async () => {
    const result = await findQueryEntries({ componentRoot: '/c', generator: GENERATOR, buildManifest: async () => successOutcome([entry({ category: '', tags: [], description: '' })]) });

    expect(result.kind).toBe('success');
    if (result.kind !== 'success') return;
    expect(result.entries[0].category).toBeUndefined();
    expect(result.entries[0].tags).toBeUndefined();
    expect(result.entries[0].description).toBeUndefined();
  });

  describe('non-success outcomes each get their own message', () => {
    const cases: readonly (readonly [BuildModelFirebaseIndexManifestOutcome, string])[] = [
      [{ kind: 'no-config', configPath: '/c/dbx-mcp.scan.json' }, 'no dbx-mcp.scan.json'],
      [{ kind: 'invalid-scan-config', configPath: '/c/dbx-mcp.scan.json', error: 'bad include' }, 'is invalid — bad include'],
      [{ kind: 'no-package', packagePath: '/c/package.json' }, 'no package.json'],
      [{ kind: 'invalid-package', packagePath: '/c/package.json', error: 'no name' }, 'is invalid — no name'],
      [{ kind: 'invalid-manifest', error: 'schema' }, 'failed validation — schema']
    ];

    for (const [outcome, expected] of cases) {
      it(`reports ${outcome.kind}`, async () => {
        const result = await findQueryEntries({ componentRoot: '/c', generator: GENERATOR, buildManifest: async () => outcome });
        expect(result.kind).toBe('failure');
        if (result.kind !== 'failure') return;
        expect(result.message).toContain(expected);
      });
    }
  });
});
