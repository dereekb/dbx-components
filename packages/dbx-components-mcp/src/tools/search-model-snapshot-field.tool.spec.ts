import { describe, expect, it } from 'vitest';
import { createModelSnapshotFieldRegistryFromEntries, type ModelSnapshotFieldEntryInfo } from '../registry/model-snapshot-fields-runtime.js';
import { searchEntries, tokenize } from './_search/score.js';
import { createSearchModelSnapshotFieldTool } from './search-model-snapshot-field.tool.js';
import { resolveSnapshotFieldTopicAlias } from './snapshot-field-alias-resolver.js';

function makeEntry(overrides: Partial<ModelSnapshotFieldEntryInfo> & Pick<ModelSnapshotFieldEntryInfo, 'slug' | 'name'>): ModelSnapshotFieldEntryInfo {
  return {
    slug: overrides.slug,
    name: overrides.name,
    kind: overrides.kind ?? 'factory',
    category: overrides.category ?? 'primitive',
    module: overrides.module ?? '@dereekb/firebase',
    subpath: overrides.subpath ?? 'common/firestore/snapshot/snapshot.field',
    signature: overrides.signature ?? `${overrides.name}()`,
    description: overrides.description ?? '',
    optional: overrides.optional ?? false,
    params: overrides.params ?? [],
    returns: overrides.returns ?? '',
    tags: overrides.tags ?? [],
    example: overrides.example ?? '',
    relatedSlugs: overrides.relatedSlugs ?? [],
    skillRefs: overrides.skillRefs ?? [],
    deprecated: overrides.deprecated ?? false,
    since: overrides.since ?? ''
  };
}

const FIRESTORE_OBJECT_ARRAY = makeEntry({
  slug: 'firestore-object-array',
  name: 'firestoreObjectArray',
  category: 'object',
  tags: ['array', 'object', 'embedded', 'nested', 'structured', 'factory']
});

const FIRESTORE_ARRAY = makeEntry({
  slug: 'firestore-array',
  name: 'firestoreArray',
  category: 'array',
  tags: ['array', 'list', 'sort', 'factory']
});

const FIRESTORE_MODEL_KEY_STRING = makeEntry({
  slug: 'firestore-model-key-string',
  name: 'firestoreModelKeyString',
  kind: 'const',
  category: 'model-key',
  tags: ['model', 'key', 'string', 'reference', 'ref', 'pointer', 'builtin']
});

const FIRESTORE_MODEL_KEY_ARRAY = makeEntry({
  slug: 'firestore-model-key-array-field',
  name: 'firestoreModelKeyArrayField',
  kind: 'const',
  category: 'model-key',
  tags: ['model', 'key', 'array', 'unique', 'reference', 'ref', 'pointer', 'builtin']
});

const FIRESTORE_DATE = makeEntry({
  slug: 'firestore-date',
  name: 'firestoreDate',
  category: 'date',
  tags: ['date', 'time', 'iso', 'timestamp', 'factory']
});

const ALL_ENTRIES = [FIRESTORE_OBJECT_ARRAY, FIRESTORE_ARRAY, FIRESTORE_MODEL_KEY_STRING, FIRESTORE_MODEL_KEY_ARRAY, FIRESTORE_DATE];

function buildTool() {
  const registry = createModelSnapshotFieldRegistryFromEntries({ entries: ALL_ENTRIES, loadedSources: ['test'] });
  return createSearchModelSnapshotFieldTool({ registry });
}

function runQuery(query: string): string {
  const tool = buildTool();
  const result = tool.run({ query });
  expect(result.isError).toBeFalsy();
  return result.content[0].text;
}

describe('dbx_model_snapshot_field_search tool', () => {
  it('returns firestoreObjectArray as the top hit for "encoded array" with the alias display surfaced', () => {
    const text = runQuery('encoded array');
    const objectArrayIndex = text.indexOf('firestore-object-array');
    const arrayIndex = text.indexOf('firestore-array');
    expect(objectArrayIndex).toBeGreaterThanOrEqual(0);
    expect(arrayIndex).toBeGreaterThan(objectArrayIndex);
    expect(text).toContain('encoded → object');
  });

  it('still returns ranked model-key hits for "model key" (regression — both tokens already match natively)', () => {
    const text = runQuery('model key');
    expect(text).toContain('firestore-model-key-array-field');
    expect(text).toContain('firestore-model-key-string');
    // alias resolver leaves untouched tokens alone
    expect(text).not.toContain('model →');
    expect(text).not.toContain('key →');
  });

  it('returns model-key family for "reference" via alias rewrite', () => {
    const text = runQuery('reference');
    expect(text).toContain('reference → model-key');
    expect(text).toContain('firestore-model-key-string');
    expect(text).toContain('firestore-model-key-array-field');
  });

  it('returns the empty-results message when every token misses', () => {
    const text = runQuery('zzznonsense');
    expect(text).toContain('No snapshot-field entries matched');
    expect(text).toContain('All tokens missed');
  });

  it('returns at least one hit when any single token matches (soft AND-of-tokens)', () => {
    // "date" matches firestoreDate; "zzznonsense" matches nothing — without
    // soft matching this would return zero hits.
    const text = runQuery('date zzznonsense');
    expect(text).toContain('firestore-date');
    expect(text).not.toContain('No snapshot-field entries matched');
  });
});

describe('snapshot-field alias resolver', () => {
  it('rewrites known intent synonyms to canonical tokens', () => {
    expect(resolveSnapshotFieldTopicAlias('encoded')).toBe('object');
    expect(resolveSnapshotFieldTopicAlias('reference')).toBe('model-key');
    expect(resolveSnapshotFieldTopicAlias('coords')).toBe('lat-lng');
    expect(resolveSnapshotFieldTopicAlias('timestamp')).toBe('date');
  });

  it('returns the normalised token unchanged for unknown inputs', () => {
    expect(resolveSnapshotFieldTopicAlias('FirestoreDate')).toBe('firestoredate');
    expect(resolveSnapshotFieldTopicAlias('anything')).toBe('anything');
  });
});

describe('searchEntries tokenMatchMode', () => {
  interface SyntheticEntry {
    readonly slug: string;
    readonly tag: string;
  }

  const entries: readonly SyntheticEntry[] = [
    { slug: 'a', tag: 'alpha' },
    { slug: 'b', tag: 'beta' },
    { slug: 'ab', tag: 'alpha-beta' }
  ];

  function scoreFn(entry: SyntheticEntry, token: string): number {
    return entry.tag.includes(token) ? 5 : 0;
  }

  it('mode "all" (default) drops entries that do not match every token', () => {
    const tokens = tokenize('alpha beta');
    const hits = searchEntries({ entries, tokens, scoreFn, tieBreaker: (e) => e.slug });
    expect(hits.map((h) => h.entry.slug)).toEqual(['ab']);
  });

  it('mode "any" accepts single-token matches and ranks full matches first', () => {
    const tokens = tokenize('alpha beta');
    const hits = searchEntries({ entries, tokens, scoreFn, tieBreaker: (e) => e.slug, mode: 'any' });
    expect(hits.map((h) => h.entry.slug)).toEqual(['ab', 'a', 'b']);
    expect(hits[0].matchedTokens.length).toBe(2);
    expect(hits[1].matchedTokens.length).toBe(1);
    expect(hits[2].matchedTokens.length).toBe(1);
  });

  it('mode "any" returns no hits when every token misses', () => {
    const tokens = tokenize('zzz qqq');
    const hits = searchEntries({ entries, tokens, scoreFn, tieBreaker: (e) => e.slug, mode: 'any' });
    expect(hits).toEqual([]);
  });
});
