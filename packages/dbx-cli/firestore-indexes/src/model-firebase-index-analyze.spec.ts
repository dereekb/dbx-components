/**
 * Vitest specs for the model-firebase-index analyzer.
 *
 * Covers the rules baked into the live HelloSubs staging deploy:
 *  - COLLECTION single-field skip (Firestore auto-indexes).
 *  - COLLECTION_GROUP single-field → fieldOverride (one variant).
 *  - COLLECTION multi-field → composite (`__name__` tiebreaker is added by
 *    the generator, not the analyzer).
 *  - COLLECTION_GROUP multi-field with mixed ASC/DESC orderBy preserves the
 *    source-order DESC direction (`jlja` `d/c/l/v/cat` pattern).
 *  - array-contains + orderBy emits `arrayConfig: CONTAINS` in the composite
 *    (`jljt.ow + r` pattern).
 *  - `@skip` / `@manual` factories produce no derived output.
 */

import { describe, expect, it } from 'vitest';
import { analyzeEntry } from './model-firebase-index-analyze.js';
import type { ExtractedModelFirebaseIndexEntry } from './model-firebase-index-extract.js';
import type { ConstraintSequence, FirestoreQueryScope } from './model-firebase-index-schema.js';

interface BuildEntryInput {
  readonly name?: string;
  readonly collection: string;
  readonly scope: FirestoreQueryScope;
  readonly isNested?: boolean;
  readonly manual?: boolean;
  readonly skip?: boolean;
  readonly allowArrayContainsAny?: boolean;
  readonly sequences: readonly ConstraintSequence[];
}

function buildEntry(input: BuildEntryInput): ExtractedModelFirebaseIndexEntry {
  return {
    slug: 'fake-slug',
    name: input.name ?? 'fakeQuery',
    model: 'Fake',
    collection: input.collection,
    isNested: input.isNested ?? false,
    scope: input.scope,
    manual: input.manual ?? false,
    skip: input.skip ?? false,
    allowArrayContainsAny: input.allowArrayContainsAny ?? false,
    category: '',
    signature: 'fakeQuery(): FirestoreQueryConstraint[]',
    description: '',
    params: [],
    returns: '',
    tags: [],
    example: '',
    constraintSequences: input.sequences,
    filePath: '/proj/src/lib/fake.query.ts',
    line: 1
  };
}

describe('analyzeEntry — COLLECTION scope', () => {
  it('skips single-field, single-orderBy queries on COLLECTION (auto-indexed)', () => {
    const entry = buildEntry({
      collection: 'fake',
      scope: 'COLLECTION',
      sequences: [
        {
          entries: [{ kind: 'where', fieldPath: 'status', operator: '==' }]
        }
      ]
    });
    const result = analyzeEntry(entry);
    expect(result.derivedComposites).toEqual([]);
    expect(result.derivedFieldOverrides).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('emits a composite for COLLECTION multi-field queries', () => {
    const entry = buildEntry({
      collection: 'jlja',
      scope: 'COLLECTION',
      sequences: [
        {
          entries: [
            { kind: 'where', fieldPath: 'd', operator: '==' },
            { kind: 'where', fieldPath: 'c', operator: '==' },
            { kind: 'orderBy', fieldPath: 'l', direction: 'desc' },
            { kind: 'orderBy', fieldPath: 'v', direction: 'asc' },
            { kind: 'orderBy', fieldPath: 'cat', direction: 'asc' }
          ]
        }
      ]
    });
    const result = analyzeEntry(entry);
    expect(result.derivedComposites.length).toBe(1);
    const composite = result.derivedComposites[0];
    expect(composite.collectionGroup).toBe('jlja');
    expect(composite.queryScope).toBe('COLLECTION');
    expect(composite.density).toBe('SPARSE_ALL');
    expect(composite.fields.map((f) => f.fieldPath)).toEqual(['d', 'c', 'l', 'v', 'cat']);
    expect(composite.fields[2].order).toBe('DESCENDING');
    expect(composite.fields[3].order).toBe('ASCENDING');
    expect(result.derivedFieldOverrides).toEqual([]);
  });
});

describe('analyzeEntry — COLLECTION_GROUP scope', () => {
  it('emits a single-variant fieldOverride for a single-field COLLECTION_GROUP query', () => {
    const entry = buildEntry({
      collection: 'jlj',
      scope: 'COLLECTION_GROUP',
      isNested: true,
      sequences: [
        {
          entries: [{ kind: 'where', fieldPath: 'lwss', operator: '==' }]
        }
      ]
    });
    const result = analyzeEntry(entry);
    expect(result.derivedComposites).toEqual([]);
    expect(result.derivedFieldOverrides.length).toBe(1);
    const override = result.derivedFieldOverrides[0];
    expect(override.collectionGroup).toBe('jlj');
    expect(override.fieldPath).toBe('lwss');
    expect(override.variants.length).toBe(1);
    expect(override.variants[0].queryScope).toBe('COLLECTION_GROUP');
    expect(override.variants[0].order).toBe('ASCENDING');
  });

  it('emits a composite for multi-field COLLECTION_GROUP queries with mixed orderBy direction', () => {
    const entry = buildEntry({
      collection: 'jlw',
      scope: 'COLLECTION_GROUP',
      isNested: true,
      sequences: [
        {
          entries: [
            { kind: 'where', fieldPath: 'jdds', operator: '==' },
            { kind: 'where', fieldPath: 'w', operator: '>=' },
            { kind: 'where', fieldPath: 'w', operator: '<=' },
            { kind: 'orderBy', fieldPath: 'w', direction: 'asc' }
          ]
        }
      ]
    });
    const result = analyzeEntry(entry);
    expect(result.derivedComposites.length).toBe(1);
    const composite = result.derivedComposites[0];
    expect(composite.collectionGroup).toBe('jlw');
    expect(composite.queryScope).toBe('COLLECTION_GROUP');
    expect(composite.fields.map((f) => f.fieldPath)).toEqual(['jdds', 'w']);
    expect(composite.fields[0].order).toBe('ASCENDING');
    expect(composite.fields[1].order).toBe('ASCENDING');
  });

  it('places array-contains-any in source order relative to equalities (jljt ow + r pattern)', () => {
    const entry = buildEntry({
      collection: 'jljt',
      scope: 'COLLECTION_GROUP',
      isNested: true,
      sequences: [
        {
          entries: [
            { kind: 'where', fieldPath: 'ow', operator: 'array-contains-any' },
            { kind: 'where', fieldPath: 'r', operator: '==' }
          ]
        }
      ]
    });
    const result = analyzeEntry(entry);
    expect(result.derivedComposites.length).toBe(1);
    const composite = result.derivedComposites[0];
    expect(composite.fields.map((f) => f.fieldPath)).toEqual(['ow', 'r']);
    expect(composite.fields[0].arrayConfig).toBe('CONTAINS');
    expect(composite.fields[1].order).toBe('ASCENDING');
  });

  it('emits arrayConfig CONTAINS for array-contains + orderBy queries', () => {
    const entry = buildEntry({
      collection: 'jljt',
      scope: 'COLLECTION_GROUP',
      isNested: true,
      sequences: [
        {
          entries: [
            { kind: 'where', fieldPath: 'ow', operator: 'array-contains' },
            { kind: 'orderBy', fieldPath: 'r', direction: 'asc' }
          ]
        }
      ]
    });
    const result = analyzeEntry(entry);
    expect(result.derivedComposites.length).toBe(1);
    const composite = result.derivedComposites[0];
    expect(composite.fields[0].fieldPath).toBe('ow');
    expect(composite.fields[0].arrayConfig).toBe('CONTAINS');
    expect(composite.fields[1].fieldPath).toBe('r');
    expect(composite.fields[1].order).toBe('ASCENDING');
  });
});

describe('analyzeEntry — flags', () => {
  it('produces no derived output for @dbxModelFirebaseIndexSkip', () => {
    const entry = buildEntry({
      collection: 'jld',
      scope: 'COLLECTION',
      skip: true,
      sequences: [
        {
          entries: [
            { kind: 'where', fieldPath: 'a', operator: '==' },
            { kind: 'where', fieldPath: 'b', operator: '==' }
          ]
        }
      ]
    });
    const result = analyzeEntry(entry);
    expect(result.derivedComposites).toEqual([]);
    expect(result.derivedFieldOverrides).toEqual([]);
  });

  it('produces no derived output for @dbxModelFirebaseIndexManual', () => {
    const entry = buildEntry({
      collection: 'sjs',
      scope: 'COLLECTION',
      manual: true,
      sequences: [
        {
          entries: [
            { kind: 'where', fieldPath: 'a', operator: '==' },
            { kind: 'where', fieldPath: 'b', operator: '==' }
          ]
        }
      ]
    });
    const result = analyzeEntry(entry);
    expect(result.derivedComposites).toEqual([]);
    expect(result.derivedFieldOverrides).toEqual([]);
  });
});

describe('analyzeEntry — diagnostics', () => {
  it('flags multiple range-field constraints', () => {
    const entry = buildEntry({
      name: 'multipleRangeQuery',
      collection: 'jld',
      scope: 'COLLECTION',
      sequences: [
        {
          entries: [
            { kind: 'where', fieldPath: 'a', operator: '>=' },
            { kind: 'where', fieldPath: 'b', operator: '<' }
          ]
        }
      ]
    });
    const result = analyzeEntry(entry);
    const warning = result.warnings.find((w) => w.kind === 'multiple-range-fields');
    expect(warning).toBeDefined();
  });

  it('flags array-contains-any as partially-supported', () => {
    const entry = buildEntry({
      name: 'arrayContainsAnyQuery',
      collection: 'jljt',
      scope: 'COLLECTION_GROUP',
      isNested: true,
      sequences: [
        {
          entries: [
            { kind: 'where', fieldPath: 'ow', operator: 'array-contains-any' },
            { kind: 'orderBy', fieldPath: 'r', direction: 'asc' }
          ]
        }
      ]
    });
    const result = analyzeEntry(entry);
    const warning = result.warnings.find((w) => w.kind === 'unsupported-array-contains-any');
    expect(warning).toBeDefined();
  });

  it('suppresses array-contains-any warning when allowArrayContainsAny is set', () => {
    const entry = buildEntry({
      name: 'arrayContainsAnyQuery',
      collection: 'jljt',
      scope: 'COLLECTION_GROUP',
      isNested: true,
      allowArrayContainsAny: true,
      sequences: [
        {
          entries: [
            { kind: 'where', fieldPath: 'ow', operator: 'array-contains-any' },
            { kind: 'orderBy', fieldPath: 'r', direction: 'asc' }
          ]
        }
      ]
    });
    const result = analyzeEntry(entry);
    const warning = result.warnings.find((w) => w.kind === 'unsupported-array-contains-any');
    expect(warning).toBeUndefined();
  });
});
