import { describe, expect, it } from 'vitest';
import { runLookupModel } from './lookup-model.tool.js';

function firstText(result: ReturnType<typeof runLookupModel>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_model_lookup', () => {
  it('rejects missing topic via arktype validation', () => {
    const result = runLookupModel({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('resolves a Firebase model by interface name', () => {
    const text = firstText(runLookupModel({ topic: 'StorageFile' }));
    expect(text).toMatch(/# StorageFile/);
    expect(text).toMatch(/\*\*Identity:\*\* `storageFileIdentity`/);
    expect(text).toMatch(/prefix `sf`/);
    expect(text).toMatch(/## Fields/);
    expect(text).toMatch(/## Enums/);
  });

  it('reports `root` store shape on a root-collection model entry', () => {
    const text = firstText(runLookupModel({ topic: 'StorageFile' }));
    expect(text).toMatch(/\*\*Store shape:\*\* `root`/);
    expect(text).toMatch(/topic="shapes"/);
  });

  it('reports `sub-collection` store shape on a sub-collection model entry', () => {
    const text = firstText(runLookupModel({ topic: 'NotificationWeek' }));
    expect(text).toMatch(/\*\*Store shape:\*\* `sub-collection`/);
    expect(text).toMatch(/subcollection of `notificationBoxIdentity`/);
  });

  it('resolves a Firebase model by collection prefix', () => {
    const text = firstText(runLookupModel({ topic: 'nb' }));
    expect(text).toMatch(/# NotificationBox/);
  });

  it('resolves the firebase catalog via "models" alias', () => {
    const text = firstText(runLookupModel({ topic: 'models' }));
    expect(text).toMatch(/# Firebase model catalog/);
    expect(text).toMatch(/## Root collections/);
    expect(text).toMatch(/## Subcollections/);
    expect(text).toMatch(/\*\*StorageFile\*\*/);
    expect(text).toMatch(/topic="shapes"/);
  });

  it('resolves the store-shape taxonomy via "shapes" alias', () => {
    const text = firstText(runLookupModel({ topic: 'shapes' }));
    expect(text).toMatch(/# Firebase model store shapes/);
    expect(text).toMatch(/`root`/);
    expect(text).toMatch(/`root-singleton`/);
    expect(text).toMatch(/`sub-collection`/);
    expect(text).toMatch(/`singleton-sub`/);
    expect(text).toMatch(/`system-state`/);
    expect(text).toMatch(/AbstractDbxFirebaseDocumentStore/);
    expect(text).toMatch(/AbstractRootSingleItemDbxFirebaseDocument/);
    expect(text).toMatch(/AbstractDbxFirebaseDocumentWithParentStore/);
    expect(text).toMatch(/AbstractSingleItemDbxFirebaseDocument/);
    expect(text).toMatch(/AbstractSystemStateDocumentStoreAccessor/);
  });

  it('also resolves the shape taxonomy via "store-shapes" alias', () => {
    const text = firstText(runLookupModel({ topic: 'store-shapes' }));
    expect(text).toMatch(/# Firebase model store shapes/);
  });

  it('returns a not-found message when nothing resolves', () => {
    const text = firstText(runLookupModel({ topic: 'zzzz-not-a-model' }));
    expect(text).toMatch(/No Firebase model matched/);
    expect(text).toMatch(/browse the catalog/);
  });
});
