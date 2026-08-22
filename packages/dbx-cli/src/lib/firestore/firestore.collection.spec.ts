import { describe, expect, it } from 'vitest';
import { type FirestoreCollectionLike } from '@dereekb/firebase';
import { CliError } from '../util/output';
import { assertCliFirestoreQueryParentKey, cliFirestoreCollectionForQuery } from './firestore.collection';
import { type CliFirestoreModels } from './firestore.models';

const REGISTERED = { __registered: true } as unknown as FirestoreCollectionLike<unknown>;
const OVERRIDE = { __override: true } as unknown as FirestoreCollectionLike<unknown>;

function buildModels(input?: { readonly collectionForModel?: CliFirestoreModels['binding']['collectionForModel'] }): CliFirestoreModels {
  return {
    session: {} as never,
    collections: {},
    binding: { collections: () => ({}), models: (() => ({})) as never, collectionForModel: input?.collectionForModel },
    models: (() => ({})) as never,
    allTypes: () => ['gb', 'gbe'],
    serviceFor: () => ({ loadModelForKey: (() => undefined) as never, getFirestoreCollection: () => REGISTERED }),
    modelTypeForCollection: (collectionName) => collectionName
  };
}

describe('cliFirestoreCollectionForQuery()', () => {
  it('returns the registered collection for a root model with no parent', () => {
    const result = cliFirestoreCollectionForQuery({ models: buildModels(), modelType: 'gb', scope: 'COLLECTION', isNested: false });
    expect(result).toBe(REGISTERED);
  });

  it('returns the registered group for a nested COLLECTION_GROUP entry with no parent', () => {
    const result = cliFirestoreCollectionForQuery({ models: buildModels(), modelType: 'gbe', scope: 'COLLECTION_GROUP', isNested: true });
    expect(result).toBe(REGISTERED);
  });

  it('rejects --parent on a root model', () => {
    let error: unknown;
    try {
      cliFirestoreCollectionForQuery({ models: buildModels(), modelType: 'gb', scope: 'COLLECTION', isNested: false, parentKey: 'gb/abc' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).message).toContain('not a subcollection');
  });

  it('requires --parent for a nested COLLECTION-scope entry', () => {
    let error: unknown;
    try {
      cliFirestoreCollectionForQuery({ models: buildModels(), modelType: 'gbe', scope: 'COLLECTION', isNested: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).suggestion).toContain('--parent');
  });

  it('lets the app override win over the derived scoping', () => {
    const models = buildModels({ collectionForModel: () => OVERRIDE });
    const result = cliFirestoreCollectionForQuery({ models, modelType: 'gbe', scope: 'COLLECTION_GROUP', isNested: true, parentKey: 'gb/abc' });
    expect(result).toBe(OVERRIDE);
  });

  it('falls through to the derived scoping when the override returns undefined', () => {
    const models = buildModels({ collectionForModel: () => undefined });
    // REGISTERED is a bare stub with no `config`, so the derivation reports it cannot be scoped
    expect(() => cliFirestoreCollectionForQuery({ models, modelType: 'gbe', scope: 'COLLECTION_GROUP', isNested: true, parentKey: 'gb/abc' })).toThrow(CliError);
  });

  it('fails clearly when the registered collection exposes no `config` to derive from', () => {
    let error: unknown;
    try {
      cliFirestoreCollectionForQuery({ models: buildModels(), modelType: 'gbe', scope: 'COLLECTION_GROUP', isNested: true, parentKey: 'gb/abc' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).suggestion).toContain('collectionForModel');
  });

  it('validates --parent before reaching the scoping derivation', () => {
    // an odd-segment key would otherwise reach `docAtPath` and surface as a raw Firestore assertion
    let error: unknown;
    try {
      cliFirestoreCollectionForQuery({ models: buildModels(), modelType: 'gbe', scope: 'COLLECTION_GROUP', isNested: true, parentKey: 'gb' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).message).toContain('not a document key');
  });
});

describe('assertCliFirestoreQueryParentKey()', () => {
  it('accepts a one-level document key', () => {
    expect(() => assertCliFirestoreQueryParentKey({ modelType: 'gbe', parentKey: 'gb/abc' })).not.toThrow();
  });

  it('accepts a deep document key', () => {
    // the `jlja` shape — the parent of a doubly-nested collection is itself two pairs deep
    expect(() => assertCliFirestoreQueryParentKey({ modelType: 'jlja', parentKey: 'jl/abc/jlj/def' })).not.toThrow();
  });

  it('rejects a collection path (odd segments)', () => {
    expect(() => assertCliFirestoreQueryParentKey({ modelType: 'jlja', parentKey: 'jl/abc/jlj' })).toThrow(CliError);
  });

  it('rejects an empty key', () => {
    expect(() => assertCliFirestoreQueryParentKey({ modelType: 'gbe', parentKey: '/' })).toThrow(CliError);
  });

  it('tolerates surrounding slashes', () => {
    expect(() => assertCliFirestoreQueryParentKey({ modelType: 'gbe', parentKey: '/gb/abc/' })).not.toThrow();
  });

  it('accepts a key whose collection chain matches a declared parent path', () => {
    expect(() => assertCliFirestoreQueryParentKey({ modelType: 'jlja', parentKey: 'jl/abc/jlj/def', parentPaths: ['jl/{jobLocation}/jlj/{job}'] })).not.toThrow();
  });

  it('rejects a well-formed key naming the WRONG ancestor chain', () => {
    // this is the failure mode that otherwise returns an empty result set indistinguishable from
    // "no matching documents"
    let error: unknown;
    try {
      assertCliFirestoreQueryParentKey({ modelType: 'jlja', parentKey: 'gb/abc', parentPaths: ['jl/{jobLocation}/jlj/{job}'] });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).suggestion).toContain('jl/{jobLocation}/jlj/{job}');
  });

  it('accepts any of several declared parent paths', () => {
    expect(() => assertCliFirestoreQueryParentKey({ modelType: 'x', parentKey: 'b/1', parentPaths: ['a/{aId}', 'b/{bId}'] })).not.toThrow();
  });

  it('skips the chain check when no parent paths are known', () => {
    // an unscanned manifest must not start rejecting keys it previously accepted
    expect(() => assertCliFirestoreQueryParentKey({ modelType: 'jlja', parentKey: 'gb/abc' })).not.toThrow();
  });
});
