import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearDownstreamCatalogCache } from '../registry/downstream-models-runtime.js';
import { runLookupModel } from './lookup-model.tool.js';

const REPO_ROOT = resolve(__dirname, '../../../..');

async function firstText(promise: ReturnType<typeof runLookupModel>): Promise<string> {
  const result = await promise;
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_model_lookup', () => {
  beforeAll(() => {
    clearDownstreamCatalogCache();
    process.chdir(REPO_ROOT);
  });

  afterAll(() => {
    clearDownstreamCatalogCache();
  });

  it('rejects missing topic via arktype validation', async () => {
    const result = await runLookupModel({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Invalid arguments/);
  });

  it('resolves a Firebase model by interface name', async () => {
    const text = await firstText(runLookupModel({ topic: 'StorageFile', scope: 'upstream' }));
    expect(text).toMatch(/# StorageFile/);
    expect(text).toMatch(/\*\*Package:\*\* `@dereekb\/firebase`/);
    expect(text).toMatch(/\*\*Identity:\*\* `storageFileIdentity`/);
    expect(text).toMatch(/prefix `sf`/);
    expect(text).toMatch(/## Fields/);
    expect(text).toMatch(/## Enums/);
  });

  it('reports `root` store shape on a root-collection model entry', async () => {
    const text = await firstText(runLookupModel({ topic: 'StorageFile', scope: 'upstream' }));
    expect(text).toMatch(/\*\*Store shape:\*\* `root`/);
    expect(text).toMatch(/topic="shapes"/);
  });

  it('reports `sub-collection` store shape on a sub-collection model entry', async () => {
    const text = await firstText(runLookupModel({ topic: 'NotificationWeek', scope: 'upstream' }));
    expect(text).toMatch(/\*\*Store shape:\*\* `sub-collection`/);
    expect(text).toMatch(/subcollection of `notificationBoxIdentity`/);
  });

  it('resolves a Firebase model by collection prefix', async () => {
    const text = await firstText(runLookupModel({ topic: 'nb', scope: 'upstream' }));
    expect(text).toMatch(/# NotificationBox/);
  });

  it('resolves the firebase catalog via "models" alias', async () => {
    const text = await firstText(runLookupModel({ topic: 'models' }));
    expect(text).toMatch(/# Firebase model catalog/);
    expect(text).toMatch(/## Root collections/);
    expect(text).toMatch(/## Subcollections/);
    expect(text).toMatch(/\*\*StorageFile\*\*/);
    expect(text).toMatch(/topic="shapes"/);
  });

  it('catalog includes a Downstream models section grouped by package', async () => {
    const text = await firstText(runLookupModel({ topic: 'models' }));
    expect(text).toMatch(/## Downstream models/);
    expect(text).toMatch(/### `demo-firebase`/);
    expect(text).toMatch(/\*\*Guestbook\*\*/);
  });

  it('resolves the store-shape taxonomy via "shapes" alias', async () => {
    const text = await firstText(runLookupModel({ topic: 'shapes' }));
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

  it('also resolves the shape taxonomy via "store-shapes" alias', async () => {
    const text = await firstText(runLookupModel({ topic: 'store-shapes' }));
    expect(text).toMatch(/# Firebase model store shapes/);
  });

  it('resolves a downstream model by name', async () => {
    const text = await firstText(runLookupModel({ topic: 'Guestbook' }));
    expect(text).toMatch(/# Guestbook/);
    expect(text).toMatch(/\*\*Package:\*\* `demo-firebase`/);
    expect(text).toMatch(/prefix `gb`/);
  });

  it('resolves a downstream model by collection prefix', async () => {
    const text = await firstText(runLookupModel({ topic: 'gb' }));
    expect(text).toMatch(/# Guestbook/);
    expect(text).toMatch(/\*\*Package:\*\* `demo-firebase`/);
  });

  it('returns a not-found message with did-you-mean candidates when nothing resolves', async () => {
    const text = await firstText(runLookupModel({ topic: 'zzzz-not-a-model' }));
    expect(text).toMatch(/No Firebase model matched/);
    expect(text).toMatch(/browse the catalog/);
  });
});
