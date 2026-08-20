import { describe, expect, it } from 'vitest';
import { type FirestoreCollectionLike } from '@dereekb/firebase';
import { CliError } from '../util/output';
import { cliFirestoreCollectionForQuery } from './firestore.collection';
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
});
