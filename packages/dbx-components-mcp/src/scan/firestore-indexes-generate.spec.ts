/**
 * Vitest specs for the `firestore.indexes.json` generator.
 *
 * Covers the emission rules baked into the live HelloSubs staging deploy:
 *  - Every composite ends with a `__name__` tiebreaker whose direction
 *    matches the last orderBy.
 *  - Every composite carries `density: "SPARSE_ALL"`.
 *  - Every COLLECTION_GROUP single-field variant is companioned with the
 *    standard COLLECTION quartet (ASC, DESC, CONTAINS).
 *  - User-authored fieldOverrides on collections no factory touches are
 *    round-tripped untouched (TTL flags, hand-trimmed entries like
 *    `sjs.adat`, etc.).
 *  - `@manual`-tagged entries are NOT regenerated; the existing composite
 *    is preserved (we test this by feeding existing JSON with a composite
 *    on a collection no factory touches).
 *  - Duplicate composites from multiple factories collapse to one entry.
 */

import { describe, expect, it } from 'vitest';
import type { ModelFirebaseIndexEntryInfo } from '../registry/model-firebase-index-runtime.js';
import { generateFirestoreIndexesJson, serializeFirestoreIndexesJson, type FirestoreIndexesJson } from './firestore-indexes-generate.js';

function makeEntry(input: { readonly slug: string; readonly manual?: boolean; readonly skip?: boolean; readonly composites?: ModelFirebaseIndexEntryInfo['derivedComposites']; readonly fieldOverrides?: ModelFirebaseIndexEntryInfo['derivedFieldOverrides'] }): ModelFirebaseIndexEntryInfo {
  return {
    slug: input.slug,
    name: input.slug,
    module: 'test-module',
    subpath: 'lib/fake',
    signature: '',
    description: '',
    model: 'Fake',
    collection: input.composites?.[0]?.collectionGroup ?? input.fieldOverrides?.[0]?.collectionGroup ?? 'fake',
    isNested: false,
    scope: 'COLLECTION',
    manual: input.manual ?? false,
    skip: input.skip ?? false,
    category: '',
    params: [],
    returns: '',
    tags: [],
    constraintSequences: [],
    derivedComposites: input.composites ?? [],
    derivedFieldOverrides: input.fieldOverrides ?? [],
    example: '',
    relatedSlugs: [],
    skillRefs: [],
    deprecated: false,
    since: ''
  };
}

describe('generateFirestoreIndexesJson — composite emission', () => {
  it('appends a __name__ tiebreaker whose direction matches the last orderBy', () => {
    const ascEntry = makeEntry({
      slug: 'asc-entry',
      composites: [
        {
          collectionGroup: 'jlw',
          queryScope: 'COLLECTION_GROUP',
          density: 'SPARSE_ALL',
          fields: [
            { fieldPath: 'jdds', order: 'ASCENDING' },
            { fieldPath: 'w', order: 'ASCENDING' }
          ]
        }
      ]
    });
    const descEntry = makeEntry({
      slug: 'desc-entry',
      composites: [
        {
          collectionGroup: 'jlja',
          queryScope: 'COLLECTION',
          density: 'SPARSE_ALL',
          fields: [
            { fieldPath: 'd', order: 'ASCENDING' },
            { fieldPath: 'l', order: 'DESCENDING' }
          ]
        }
      ]
    });
    const { json } = generateFirestoreIndexesJson({ entries: [ascEntry, descEntry] });
    expect(json.indexes.length).toBe(2);
    const jlw = json.indexes.find((i) => i.collectionGroup === 'jlw')!;
    const jlja = json.indexes.find((i) => i.collectionGroup === 'jlja')!;
    expect(jlw.fields.at(-1)).toEqual({ fieldPath: '__name__', order: 'ASCENDING' });
    expect(jlja.fields.at(-1)).toEqual({ fieldPath: '__name__', order: 'DESCENDING' });
  });

  it('emits density SPARSE_ALL on every composite', () => {
    const entry = makeEntry({
      slug: 'with-density',
      composites: [
        {
          collectionGroup: 'jlw',
          queryScope: 'COLLECTION_GROUP',
          density: 'SPARSE_ALL',
          fields: [{ fieldPath: 'a', order: 'ASCENDING' }]
        }
      ]
    });
    const { json } = generateFirestoreIndexesJson({ entries: [entry] });
    expect(json.indexes[0].density).toBe('SPARSE_ALL');
  });

  it('deduplicates identical composites across factories', () => {
    const composite = {
      collectionGroup: 'jlw',
      queryScope: 'COLLECTION_GROUP' as const,
      density: 'SPARSE_ALL' as const,
      fields: [
        { fieldPath: 'jdds', order: 'ASCENDING' as const },
        { fieldPath: 'w', order: 'ASCENDING' as const }
      ]
    };
    const a = makeEntry({ slug: 'a', composites: [composite] });
    const b = makeEntry({ slug: 'b', composites: [composite] });
    const { json } = generateFirestoreIndexesJson({ entries: [a, b] });
    expect(json.indexes.length).toBe(1);
  });
});

describe('generateFirestoreIndexesJson — fieldOverride emission', () => {
  it('emits the COLLECTION quartet when a COLLECTION_GROUP single-field variant is requested', () => {
    const entry = makeEntry({
      slug: 'jlj-lwss',
      fieldOverrides: [
        {
          collectionGroup: 'jlj',
          fieldPath: 'lwss',
          variants: [{ queryScope: 'COLLECTION_GROUP', order: 'ASCENDING' }]
        }
      ]
    });
    const { json } = generateFirestoreIndexesJson({ entries: [entry] });
    expect(json.fieldOverrides.length).toBe(1);
    const fieldOverride = json.fieldOverrides[0];
    expect(fieldOverride.collectionGroup).toBe('jlj');
    expect(fieldOverride.fieldPath).toBe('lwss');
    const variants = fieldOverride.indexes;
    expect(variants).toContainEqual({ queryScope: 'COLLECTION', order: 'ASCENDING' });
    expect(variants).toContainEqual({ queryScope: 'COLLECTION', order: 'DESCENDING' });
    expect(variants).toContainEqual({ queryScope: 'COLLECTION', arrayConfig: 'CONTAINS' });
    expect(variants).toContainEqual({ queryScope: 'COLLECTION_GROUP', order: 'ASCENDING' });
  });

  it('does not emit a quartet when only COLLECTION-scope variants are present', () => {
    const entry = makeEntry({
      slug: 'collection-only',
      fieldOverrides: [
        {
          collectionGroup: 'jlj',
          fieldPath: 'lwss',
          variants: [{ queryScope: 'COLLECTION', order: 'ASCENDING' }]
        }
      ]
    });
    const { json } = generateFirestoreIndexesJson({ entries: [entry] });
    const fieldOverride = json.fieldOverrides.find((f) => f.collectionGroup === 'jlj' && f.fieldPath === 'lwss');
    expect(fieldOverride).toBeDefined();
    expect(fieldOverride!.indexes).toEqual([]);
  });
});

describe('generateFirestoreIndexesJson — preservation of user-authored content', () => {
  it('round-trips fieldOverrides on collections no factory touches', () => {
    const existingJson: FirestoreIndexesJson = {
      indexes: [],
      fieldOverrides: [
        {
          collectionGroup: 'sjs',
          fieldPath: 'adat',
          indexes: [{ queryScope: 'COLLECTION', order: 'ASCENDING' }]
        }
      ]
    };
    const entry = makeEntry({
      slug: 'unrelated',
      composites: [
        {
          collectionGroup: 'jlw',
          queryScope: 'COLLECTION_GROUP',
          density: 'SPARSE_ALL',
          fields: [{ fieldPath: 'a', order: 'ASCENDING' }]
        }
      ]
    });
    const { json } = generateFirestoreIndexesJson({ entries: [entry], existingJson });
    const preserved = json.fieldOverrides.find((f) => f.collectionGroup === 'sjs' && f.fieldPath === 'adat');
    expect(preserved).toBeDefined();
    expect(preserved!.indexes).toEqual([{ queryScope: 'COLLECTION', order: 'ASCENDING' }]);
  });

  it('preserves existing composites on collections no factory touches', () => {
    const existingComposite = {
      collectionGroup: 'unknown',
      queryScope: 'COLLECTION' as const,
      fields: [
        { fieldPath: 'a', order: 'ASCENDING' as const },
        { fieldPath: 'b', order: 'ASCENDING' as const }
      ],
      density: 'SPARSE_ALL' as const
    };
    const existingJson: FirestoreIndexesJson = {
      indexes: [existingComposite],
      fieldOverrides: []
    };
    const entry = makeEntry({
      slug: 'unrelated',
      composites: [
        {
          collectionGroup: 'jlw',
          queryScope: 'COLLECTION_GROUP',
          density: 'SPARSE_ALL',
          fields: [{ fieldPath: 'a', order: 'ASCENDING' }]
        }
      ]
    });
    const { json } = generateFirestoreIndexesJson({ entries: [entry], existingJson });
    const preserved = json.indexes.find((i) => i.collectionGroup === 'unknown');
    expect(preserved).toBeDefined();
  });

  it('skips entries flagged with skip', () => {
    const entry = makeEntry({
      slug: 'skipped',
      skip: true,
      composites: [
        {
          collectionGroup: 'should-not-emit',
          queryScope: 'COLLECTION',
          density: 'SPARSE_ALL',
          fields: [
            { fieldPath: 'a', order: 'ASCENDING' },
            { fieldPath: 'b', order: 'ASCENDING' }
          ]
        }
      ]
    });
    const { json } = generateFirestoreIndexesJson({ entries: [entry] });
    expect(json.indexes.find((i) => i.collectionGroup === 'should-not-emit')).toBeUndefined();
  });
});

describe('generateFirestoreIndexesJson — diff + serialization', () => {
  it('reports added composites when no existing JSON is supplied', () => {
    const entry = makeEntry({
      slug: 'new-one',
      composites: [
        {
          collectionGroup: 'jlw',
          queryScope: 'COLLECTION_GROUP',
          density: 'SPARSE_ALL',
          fields: [{ fieldPath: 'a', order: 'ASCENDING' }]
        }
      ]
    });
    const { diff } = generateFirestoreIndexesJson({ entries: [entry] });
    expect(diff.added.length).toBe(1);
    expect(diff.removed.length).toBe(0);
  });

  it('serializes with trailing newline so byte-compare works', () => {
    const json: FirestoreIndexesJson = { indexes: [], fieldOverrides: [] };
    const serialized = serializeFirestoreIndexesJson(json);
    expect(serialized.endsWith('\n')).toBe(true);
  });

  it('canonicalizes composite + fieldOverride order across runs', () => {
    const a = makeEntry({
      slug: 'b-first',
      composites: [
        {
          collectionGroup: 'jlja',
          queryScope: 'COLLECTION',
          density: 'SPARSE_ALL',
          fields: [
            { fieldPath: 'd', order: 'ASCENDING' },
            { fieldPath: 'l', order: 'ASCENDING' }
          ]
        }
      ]
    });
    const b = makeEntry({
      slug: 'a-first',
      composites: [
        {
          collectionGroup: 'bgi',
          queryScope: 'COLLECTION_GROUP',
          density: 'SPARSE_ALL',
          fields: [
            { fieldPath: 'x', order: 'ASCENDING' },
            { fieldPath: 'y', order: 'ASCENDING' }
          ]
        }
      ]
    });
    const first = generateFirestoreIndexesJson({ entries: [a, b] });
    const second = generateFirestoreIndexesJson({ entries: [b, a] });
    expect(serializeFirestoreIndexesJson(first.json)).toBe(serializeFirestoreIndexesJson(second.json));
    expect(first.json.indexes[0].collectionGroup).toBe('bgi');
  });
});
