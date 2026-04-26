import { describe, expect, it } from 'vitest';
import { FIREBASE_MODELS, getFirebaseModel, getFirebaseModelByPrefix, getFirebaseModels, getFirebasePrefixCatalog, getFirebaseSubcollectionsOf } from './index.js';

describe('firebase-models registry', () => {
  it('exposes a non-empty list including the core library models', () => {
    expect(FIREBASE_MODELS.length).toBeGreaterThan(0);
    expect(getFirebaseModels()).toBe(FIREBASE_MODELS);
    const names = new Set(FIREBASE_MODELS.map((m) => m.name));
    expect(names.has('StorageFile'), 'StorageFile missing from registry').toBe(true);
    expect(names.has('NotificationBox'), 'NotificationBox missing from registry').toBe(true);
    expect(names.has('SystemState'), 'SystemState missing from registry').toBe(true);
  });

  it('gives every entry a unique name, identityConst, and collection prefix', () => {
    const names = new Set<string>();
    const identities = new Set<string>();
    const prefixes = new Set<string>();
    for (const model of FIREBASE_MODELS) {
      expect(names.has(model.name), `duplicate name: ${model.name}`).toBe(false);
      names.add(model.name);
      expect(identities.has(model.identityConst), `duplicate identityConst: ${model.identityConst}`).toBe(false);
      identities.add(model.identityConst);
      expect(model.collectionPrefix.length, `${model.name} missing collection prefix`).toBeGreaterThan(0);
      expect(prefixes.has(model.collectionPrefix), `duplicate collection prefix: ${model.collectionPrefix}`).toBe(false);
      prefixes.add(model.collectionPrefix);
    }
  });

  it('populates converter + field list for every model', () => {
    for (const model of FIREBASE_MODELS) {
      expect(model.fields.length, `${model.name} has no fields`).toBeGreaterThan(0);
      expect(model.sourceFile.endsWith('.ts'), `${model.name} sourceFile is not a .ts path`).toBe(true);
      for (const field of model.fields) {
        expect(field.name.length, `${model.name} has an unnamed field`).toBeGreaterThan(0);
        expect(field.converter.length, `${model.name}.${field.name} missing converter expression`).toBeGreaterThan(0);
      }
    }
  });

  it('resolves each enum reference to a real enum declaration on the same model', () => {
    for (const model of FIREBASE_MODELS) {
      const enumNames = new Set(model.enums.map((e) => e.name));
      for (const field of model.fields) {
        if (field.enumRef) {
          expect(enumNames.has(field.enumRef), `${model.name}.${field.name} references enum ${field.enumRef} not declared on the model`).toBe(true);
        }
      }
    }
  });

  it('records parent identity for subcollections and roots have none', () => {
    const rootIdentities = new Set(FIREBASE_MODELS.filter((m) => !m.parentIdentityConst).map((m) => m.identityConst));
    for (const model of FIREBASE_MODELS) {
      if (model.parentIdentityConst) {
        expect(rootIdentities.has(model.parentIdentityConst), `${model.name} parent ${model.parentIdentityConst} not a known root identity`).toBe(true);
      }
    }
  });

  it('PRIMARY index: getFirebaseModelByPrefix resolves StorageFile via "sf"', () => {
    const match = getFirebaseModelByPrefix('sf');
    expect(match?.name).toBe('StorageFile');
    expect(getFirebaseModelByPrefix('SF')?.name).toBe('StorageFile');
    expect(getFirebaseModelByPrefix('not-a-prefix')).toBeUndefined();
  });

  it('getFirebaseModel resolves by name, identityConst, and modelType', () => {
    expect(getFirebaseModel('StorageFile')?.collectionPrefix).toBe('sf');
    expect(getFirebaseModel('storageFileIdentity')?.name).toBe('StorageFile');
    expect(getFirebaseModel('storageFile')?.name).toBe('StorageFile');
    expect(getFirebaseModel('nope')).toBeUndefined();
  });

  it('getFirebaseSubcollectionsOf returns NotificationBox children', () => {
    const subs = getFirebaseSubcollectionsOf('notificationBoxIdentity');
    const subNames = new Set(subs.map((m) => m.name));
    expect(subNames.has('Notification'), 'Notification subcollection missing').toBe(true);
    expect(subNames.has('NotificationWeek'), 'NotificationWeek subcollection missing').toBe(true);
    expect(getFirebaseSubcollectionsOf('nothing')).toEqual([]);
  });

  it('prefix catalog is sorted and unique', () => {
    const catalog = getFirebasePrefixCatalog();
    expect(catalog.length).toBe(FIREBASE_MODELS.length);
    const sorted = [...catalog].sort((a, b) => a.localeCompare(b));
    expect(catalog).toEqual(sorted);
  });
});
