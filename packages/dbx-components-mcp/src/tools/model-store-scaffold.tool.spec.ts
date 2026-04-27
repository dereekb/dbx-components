import { describe, expect, it } from 'vitest';
import { runModelStoreScaffold } from './model-store-scaffold.tool.js';

const ROOT_BASE = {
  model_name: 'Guestbook',
  app_prefix: 'demo',
  firebase_package: 'demo-firebase',
  collections_class: 'DemoFirestoreCollections'
};

const SUB_BASE = {
  model_name: 'GuestbookEntry',
  app_prefix: 'demo',
  firebase_package: 'demo-firebase',
  collections_class: 'DemoFirestoreCollections',
  shape: 'sub-collection' as const,
  parent_model: { name: 'Guestbook' }
};

const SINGLETON_SUB_BASE = {
  model_name: 'ProfilePrivate',
  app_prefix: 'hellosubs',
  firebase_package: 'hellosubs-firebase',
  collections_class: 'HellosubsFirestoreCollections',
  shape: 'singleton-sub' as const,
  parent_model: { name: 'Profile' }
};

const ROOT_SINGLETON_BASE = {
  model_name: 'AppConfig',
  app_prefix: 'demo',
  firebase_package: 'demo-firebase',
  collections_class: 'DemoFirestoreCollections',
  shape: 'root-singleton' as const
};

const SYSTEM_STATE_BASE = {
  model_name: 'CheckHqCompany',
  app_prefix: 'hellosubs',
  firebase_package: 'hellosubs-firebase',
  shape: 'system-state' as const,
  system_state_type_const: 'HELLOSUBS_CHECKHQ_COMPANY_SYSTEM_STATE_TYPE',
  data_type: 'HellosubsCheckHqCompanySystemData'
};

describe('dbx_model_store_scaffold', () => {
  describe('shared validation', () => {
    it('returns isError when model_name is missing', () => {
      const { model_name: _omit, ...rest } = ROOT_BASE;
      const result = runModelStoreScaffold(rest);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid arguments');
    });

    it('returns isError when app_prefix is missing', () => {
      const { app_prefix: _omit, ...rest } = ROOT_BASE;
      const result = runModelStoreScaffold(rest);
      expect(result.isError).toBe(true);
    });

    it('returns isError when firebase_package is missing', () => {
      const { firebase_package: _omit, ...rest } = ROOT_BASE;
      const result = runModelStoreScaffold(rest);
      expect(result.isError).toBe(true);
    });

    it('rejects empty model_name after trimming', () => {
      const result = runModelStoreScaffold({ ...ROOT_BASE, model_name: '   ' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('must not be empty');
    });

    it('rejects an empty surfaces array', () => {
      const result = runModelStoreScaffold({ ...ROOT_BASE, surfaces: [] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/at least one of/);
    });

    it('defaults shape to "root" when omitted', () => {
      const text = runModelStoreScaffold(ROOT_BASE).content[0].text;
      expect(text).toContain('Shape: `root`');
    });
  });

  describe('shape=root', () => {
    it('emits all four blocks by default', () => {
      const text = runModelStoreScaffold(ROOT_BASE).content[0].text;
      expect(text).toContain('## `guestbook.document.store.ts`');
      expect(text).toContain('## `guestbook.document.store.directive.ts`');
      expect(text).toContain('## `guestbook.collection.store.ts`');
      expect(text).toContain('## `guestbook.collection.store.directive.ts`');
    });

    it('uses AbstractDbxFirebaseDocumentStore + firestoreCollection', () => {
      const text = runModelStoreScaffold(ROOT_BASE).content[0].text;
      expect(text).toContain('extends AbstractDbxFirebaseDocumentStore<Guestbook, GuestbookDocument>');
      expect(text).toContain('inject(DemoFirestoreCollections).guestbookCollection');
    });

    it('renders the directive selector and class with prefix derivations', () => {
      const text = runModelStoreScaffold(ROOT_BASE).content[0].text;
      expect(text).toContain(`selector: '[demoGuestbookDocument]'`);
      expect(text).toContain('export class DemoGuestbookDocumentStoreDirective');
      expect(text).toContain(`selector: '[demoGuestbookCollection]'`);
    });

    it('omits collection blocks when surfaces=["document"]', () => {
      const text = runModelStoreScaffold({ ...ROOT_BASE, surfaces: ['document'] }).content[0].text;
      expect(text).toContain('## `guestbook.document.store.ts`');
      expect(text).not.toContain('## `guestbook.collection.store.ts`');
    });

    it('respects a custom collection_accessor', () => {
      const text = runModelStoreScaffold({ ...ROOT_BASE, collection_accessor: 'guestbookRootCollection' }).content[0].text;
      expect(text).toContain('inject(DemoFirestoreCollections).guestbookRootCollection');
    });

    it('rejects parent_model on a root shape', () => {
      const result = runModelStoreScaffold({ ...ROOT_BASE, parent_model: { name: 'Foo' } });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/parent_model is only valid/);
    });

    it('rejects system_state_type_const on a non-system-state shape', () => {
      const result = runModelStoreScaffold({ ...ROOT_BASE, system_state_type_const: 'FOO_TYPE' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/system_state_type_const is only valid/);
    });
  });

  describe('shape=root-singleton', () => {
    it('emits document-only output by default', () => {
      const text = runModelStoreScaffold(ROOT_SINGLETON_BASE).content[0].text;
      expect(text).toContain('Shape: `root-singleton`');
      expect(text).toContain('## `appconfig.document.store.ts`');
      expect(text).toContain('## `appconfig.document.store.directive.ts`');
      expect(text).not.toContain('## `appconfig.collection.store.ts`');
    });

    it('uses AbstractRootSingleItemDbxFirebaseDocument as the base class', () => {
      const text = runModelStoreScaffold(ROOT_SINGLETON_BASE).content[0].text;
      expect(text).toContain('extends AbstractRootSingleItemDbxFirebaseDocument<AppConfig, AppConfigDocument>');
      expect(text).toContain('inject(DemoFirestoreCollections).appConfigCollection');
    });

    it('rejects surfaces=["collection"]', () => {
      const result = runModelStoreScaffold({ ...ROOT_SINGLETON_BASE, surfaces: ['collection'] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/does not support surface "collection"/);
    });
  });

  describe('shape=sub-collection', () => {
    it('emits all four blocks by default with WithParent base classes', () => {
      const text = runModelStoreScaffold(SUB_BASE).content[0].text;
      expect(text).toContain('Shape: `sub-collection`');
      expect(text).toContain('## `guestbookentry.document.store.ts`');
      expect(text).toContain('## `guestbookentry.document.store.directive.ts`');
      expect(text).toContain('## `guestbookentry.collection.store.ts`');
      expect(text).toContain('## `guestbookentry.collection.store.directive.ts`');
      expect(text).toContain('extends AbstractDbxFirebaseDocumentWithParentStore<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument>');
      expect(text).toContain('extends AbstractDbxFirebaseCollectionWithParentStore<GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDocument>');
    });

    it('wires collectionFactory + firestoreCollectionLike on the document store', () => {
      const text = runModelStoreScaffold(SUB_BASE).content[0].text;
      const docBlock = text.split('## `guestbookentry.document.store.ts`')[1].split('## ')[0];
      expect(docBlock).toContain('collectionFactory: collections.guestbookEntryCollectionFactory');
      expect(docBlock).toContain('firestoreCollectionLike: collections.guestbookEntryCollectionGroup');
    });

    it('wires collectionFactory + collectionGroup on the collection store', () => {
      const text = runModelStoreScaffold(SUB_BASE).content[0].text;
      const collBlock = text.split('## `guestbookentry.collection.store.ts`')[1].split('## ')[0];
      expect(collBlock).toContain('collectionFactory: collections.guestbookEntryCollectionFactory');
      expect(collBlock).toContain('collectionGroup: collections.guestbookEntryCollectionGroup');
    });

    it('injects the parent document store with optional + setParentStore', () => {
      const text = runModelStoreScaffold(SUB_BASE).content[0].text;
      expect(text).toContain('inject(GuestbookDocumentStore, { optional: true })');
      expect(text).toContain('this.setParentStore(parent);');
      expect(text).toContain(`import { GuestbookDocumentStore } from './guestbook.document.store';`);
    });

    it('rejects sub-collection without parent_model', () => {
      const { parent_model: _omit, ...rest } = SUB_BASE;
      const result = runModelStoreScaffold(rest);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/parent_model is required/);
    });

    it('respects a custom parent_model.document_type alias', () => {
      const text = runModelStoreScaffold({ ...SUB_BASE, parent_model: { name: 'Guestbook', document_type: 'GuestbookDoc' } }).content[0].text;
      expect(text).toContain('GuestbookEntry, Guestbook, GuestbookEntryDocument, GuestbookDoc');
    });
  });

  describe('shape=singleton-sub', () => {
    it('emits doc-only with AbstractSingleItemDbxFirebaseDocument', () => {
      const text = runModelStoreScaffold(SINGLETON_SUB_BASE).content[0].text;
      expect(text).toContain('Shape: `singleton-sub`');
      expect(text).toContain('## `profileprivate.document.store.ts`');
      expect(text).toContain('## `profileprivate.document.store.directive.ts`');
      expect(text).not.toContain('## `profileprivate.collection.store.ts`');
      expect(text).toContain('extends AbstractSingleItemDbxFirebaseDocument<ProfilePrivate, Profile, ProfilePrivateDocument, ProfileDocument>');
    });

    it('rejects surfaces=["collection"]', () => {
      const result = runModelStoreScaffold({ ...SINGLETON_SUB_BASE, surfaces: ['collection'] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/does not support surface "collection"/);
    });

    it('still injects the parent document store', () => {
      const text = runModelStoreScaffold(SINGLETON_SUB_BASE).content[0].text;
      expect(text).toContain('inject(ProfileDocumentStore, { optional: true })');
      expect(text).toContain('this.setParentStore(parent);');
    });
  });

  describe('shape=system-state', () => {
    it('emits a single accessor file with the .store.accessor.ts suffix', () => {
      const text = runModelStoreScaffold(SYSTEM_STATE_BASE).content[0].text;
      expect(text).toContain('Shape: `system-state`');
      expect(text).toContain('## `checkhqcompany.store.accessor.ts`');
      expect(text).not.toContain('document.store.ts');
      expect(text).not.toMatch(/## `[^`]*directive[^`]*`/);
    });

    it('uses AbstractSystemStateDocumentStoreAccessor with the data type', () => {
      const text = runModelStoreScaffold(SYSTEM_STATE_BASE).content[0].text;
      expect(text).toContain('extends AbstractSystemStateDocumentStoreAccessor<HellosubsCheckHqCompanySystemData>');
      expect(text).toContain('export class HellosubsCheckHqCompanySystemStateDocumentStoreAccessor');
      expect(text).toContain('super(HELLOSUBS_CHECKHQ_COMPANY_SYSTEM_STATE_TYPE);');
    });

    it('does not import or inject a Firestore-collections class', () => {
      const text = runModelStoreScaffold(SYSTEM_STATE_BASE).content[0].text;
      expect(text).not.toContain('FirestoreCollections');
      expect(text).not.toContain('firestoreCollection:');
      expect(text).not.toContain('collectionFactory:');
    });

    it('rejects collection surface for system-state', () => {
      const result = runModelStoreScaffold({ ...SYSTEM_STATE_BASE, surfaces: ['collection'] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/does not support surface "collection"/);
    });

    it('requires system_state_type_const + data_type', () => {
      const { system_state_type_const: _o1, ...without1 } = SYSTEM_STATE_BASE;
      const r1 = runModelStoreScaffold(without1);
      expect(r1.isError).toBe(true);
      expect(r1.content[0].text).toMatch(/system_state_type_const is required/);

      const { data_type: _o2, ...without2 } = SYSTEM_STATE_BASE;
      const r2 = runModelStoreScaffold(without2);
      expect(r2.isError).toBe(true);
      expect(r2.content[0].text).toMatch(/data_type is required/);
    });
  });

  describe('functions + crud_functions wiring', () => {
    it('injects the functions class on the document store', () => {
      const text = runModelStoreScaffold({ ...ROOT_BASE, functions_class: 'GuestbookFunctions' }).content[0].text;
      expect(text).toContain('readonly guestbookFunctions = inject(GuestbookFunctions);');
    });

    it('does not import GuestbookFunctions in the collection store', () => {
      const text = runModelStoreScaffold({ ...ROOT_BASE, functions_class: 'GuestbookFunctions' }).content[0].text;
      const collBlock = text.split('## `guestbook.collection.store.ts`')[1].split('## `guestbook.collection.store.directive.ts`')[0];
      expect(collBlock).not.toContain('GuestbookFunctions');
    });

    it('emits crud_functions with the correct helper per kind', () => {
      const result = runModelStoreScaffold({
        ...ROOT_BASE,
        functions_class: 'GuestbookFunctions',
        crud_functions: [
          { name: 'createGuestbook', kind: 'create', functions_path: 'guestbook.createGuestbook' },
          { name: 'updateGuestbook', kind: 'update', functions_path: 'guestbook.updateGuestbook' },
          { name: 'readGuestbookSnapshot', kind: 'crud', functions_path: 'guestbook.readGuestbookSnapshot' }
        ]
      });
      const text = result.content[0].text;
      expect(text).toContain('readonly createGuestbook = firebaseDocumentStoreCreateFunction(this, this.guestbookFunctions.guestbook.createGuestbook);');
      expect(text).toContain('readonly updateGuestbook = firebaseDocumentStoreUpdateFunction(this, this.guestbookFunctions.guestbook.updateGuestbook);');
      expect(text).toContain('readonly readGuestbookSnapshot = firebaseDocumentStoreCrudFunction(this.guestbookFunctions.guestbook.readGuestbookSnapshot);');
    });

    it('uses this.systemStateDocumentStore as the storeRef for system-state crud_functions', () => {
      const result = runModelStoreScaffold({
        ...SYSTEM_STATE_BASE,
        functions_class: 'SystemStateFunctions',
        crud_functions: [
          { name: 'initCheckHqCompany', kind: 'create', functions_path: 'systemState.createSystemState.initcheckhqcompany' },
          { name: 'readCheckHqCompanyOnboard', kind: 'crud', functions_path: 'systemState.readSystemState.readCheckHqCompanyOnboard' }
        ]
      });
      const text = result.content[0].text;
      expect(text).toContain('readonly initCheckHqCompany = firebaseDocumentStoreCreateFunction(this.systemStateDocumentStore, this.systemStateFunctions.systemState.createSystemState.initcheckhqcompany);');
      expect(text).toContain('readonly readCheckHqCompanyOnboard = firebaseDocumentStoreCrudFunction(this.systemStateFunctions.systemState.readSystemState.readCheckHqCompanyOnboard);');
    });

    it('rejects crud_functions without functions_class', () => {
      const result = runModelStoreScaffold({
        ...ROOT_BASE,
        crud_functions: [{ name: 'createGuestbook', kind: 'create', functions_path: 'guestbook.createGuestbook' }]
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/crud_functions requires functions_class/);
    });

    it('still accepts the legacy create_function shortcut', () => {
      const text = runModelStoreScaffold({
        ...ROOT_BASE,
        functions_class: 'GuestbookFunctions',
        create_function: { name: 'createGuestbook', functions_path: 'guestbook.createGuestbook' }
      }).content[0].text;
      expect(text).toContain('readonly createGuestbook = firebaseDocumentStoreCreateFunction(this, this.guestbookFunctions.guestbook.createGuestbook);');
    });
  });

  describe('file_base_name override', () => {
    it('honors a dotted file_base_name (matches demo guestbook.entry style)', () => {
      const text = runModelStoreScaffold({ ...SUB_BASE, file_base_name: 'guestbook.entry' }).content[0].text;
      expect(text).toContain('## `guestbook.entry.document.store.ts`');
      expect(text).toContain('## `guestbook.entry.collection.store.ts`');
    });
  });
});
