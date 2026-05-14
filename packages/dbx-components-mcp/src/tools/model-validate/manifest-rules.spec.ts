import { describe, expect, it } from 'vitest';
import { checkManifestIdentityDuplicates } from './manifest-rules.js';
import type { FirebaseModel } from '../../registry/firebase-models.js';

function makeModel(overrides: Partial<FirebaseModel> & Pick<FirebaseModel, 'name' | 'identityConst' | 'modelType' | 'collectionPrefix'>): FirebaseModel {
  return {
    description: undefined,
    parentIdentityConst: undefined,
    sourcePackage: '@dereekb/firebase',
    sourceFile: `packages/firebase/src/lib/model/${overrides.modelType}.ts`,
    fields: [],
    enums: [],
    detectionHints: [],
    modelGroup: undefined,
    collectionKind: 'root',
    userKeyedById: undefined,
    hasUserUidField: undefined,
    ...overrides
  };
}

describe('checkManifestIdentityDuplicates', () => {
  it('returns no violations when every identity has a unique collectionName and modelType', () => {
    const models: FirebaseModel[] = [makeModel({ name: 'Profile', identityConst: 'profileIdentity', modelType: 'profile', collectionPrefix: 'pr' }), makeModel({ name: 'StorageFile', identityConst: 'storageFileIdentity', modelType: 'storageFile', collectionPrefix: 'sf' })];
    const result = checkManifestIdentityDuplicates(models);
    expect(result).toEqual([]);
  });

  it('flags a single MODEL_IDENTITY_COLLECTION_NAME_DUPLICATE for two identities sharing a collectionPrefix across packages', () => {
    const models: FirebaseModel[] = [makeModel({ name: 'Profile', identityConst: 'profileIdentity', modelType: 'profile', collectionPrefix: 'u', sourcePackage: '@dereekb/firebase' }), makeModel({ name: 'User', identityConst: 'userIdentity', modelType: 'user', collectionPrefix: 'u', sourcePackage: 'demo-firebase', sourceFile: 'components/demo-firebase/src/lib/model/user.ts' })];
    const result = checkManifestIdentityDuplicates(models);
    expect(result.map((v) => v.code)).toEqual(['MODEL_IDENTITY_COLLECTION_NAME_DUPLICATE']);
    const [violation] = result;
    expect(violation.severity).toBe('error');
    expect(violation.file).toBe('components/demo-firebase/src/lib/model/user.ts');
    expect(violation.model).toBe('User');
    expect(violation.message).toContain("'u'");
    expect(violation.message).toContain('profileIdentity');
    expect(violation.message).toContain('userIdentity');
  });

  it('flags MODEL_IDENTITY_MODEL_TYPE_DUPLICATE for two identities sharing a modelType', () => {
    const models: FirebaseModel[] = [makeModel({ name: 'Profile', identityConst: 'profileIdentity', modelType: 'profile', collectionPrefix: 'pr' }), makeModel({ name: 'ProfileV2', identityConst: 'profileV2Identity', modelType: 'profile', collectionPrefix: 'pr2' })];
    const result = checkManifestIdentityDuplicates(models);
    expect(result.map((v) => v.code)).toEqual(['MODEL_IDENTITY_MODEL_TYPE_DUPLICATE']);
    expect(result[0].message).toContain("'profile'");
  });

  it('emits both codes when two identities collide on both attributes', () => {
    const models: FirebaseModel[] = [makeModel({ name: 'Profile', identityConst: 'profileIdentity', modelType: 'profile', collectionPrefix: 'pr' }), makeModel({ name: 'ProfileDuplicate', identityConst: 'profileDuplicateIdentity', modelType: 'profile', collectionPrefix: 'pr' })];
    const result = checkManifestIdentityDuplicates(models);
    const codes = result.map((v) => v.code).sort();
    expect(codes).toEqual(['MODEL_IDENTITY_COLLECTION_NAME_DUPLICATE', 'MODEL_IDENTITY_MODEL_TYPE_DUPLICATE']);
  });

  it('emits one violation per duplicate after the first when three identities collide', () => {
    const models: FirebaseModel[] = [makeModel({ name: 'A', identityConst: 'aIdentity', modelType: 'a', collectionPrefix: 'x' }), makeModel({ name: 'B', identityConst: 'bIdentity', modelType: 'b', collectionPrefix: 'x' }), makeModel({ name: 'C', identityConst: 'cIdentity', modelType: 'c', collectionPrefix: 'x' })];
    const result = checkManifestIdentityDuplicates(models);
    const collisions = result.filter((v) => v.code === 'MODEL_IDENTITY_COLLECTION_NAME_DUPLICATE');
    expect(collisions).toHaveLength(2);
    expect(collisions[0].model).toBe('B');
    expect(collisions[1].model).toBe('C');
  });

  it('flags collisions regardless of root vs. subcollection variant', () => {
    const models: FirebaseModel[] = [makeModel({ name: 'Profile', identityConst: 'profileIdentity', modelType: 'profile', collectionPrefix: 'pr', collectionKind: 'root' }), makeModel({ name: 'NestedProfile', identityConst: 'nestedProfileIdentity', modelType: 'nestedProfile', collectionPrefix: 'pr', parentIdentityConst: 'userIdentity', collectionKind: 'sub-collection' })];
    const result = checkManifestIdentityDuplicates(models);
    expect(result.map((v) => v.code)).toEqual(['MODEL_IDENTITY_COLLECTION_NAME_DUPLICATE']);
  });

  it('skips entries with empty collectionPrefix or modelType', () => {
    const models: FirebaseModel[] = [makeModel({ name: 'A', identityConst: 'aIdentity', modelType: '', collectionPrefix: '' }), makeModel({ name: 'B', identityConst: 'bIdentity', modelType: '', collectionPrefix: '' })];
    const result = checkManifestIdentityDuplicates(models);
    expect(result).toEqual([]);
  });
});
