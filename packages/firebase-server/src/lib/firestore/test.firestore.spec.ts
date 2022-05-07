import { DocumentReference, Transaction, Firestore } from '@google-cloud/firestore';
import { DocumentSnapshot, MockItem, mockItemCollectionReference, MockItemDocument, MockItemFirestoreCollection, mockItemFirestoreCollection, authorizedTestWithMockItemCollection, FirestoreDocumentContext, makeFirestoreCollection } from "@dereekb/firebase";
import { transactionDocumentContext } from './driver.accessor.transaction';
import { Maybe } from '@dereekb/util';
import { adminTestWithMockItemCollection } from '../../test/firestore/firestore.fixture.admin';
import { googleCloudFirestoreDrivers } from './driver';
import { writeBatchDocumentContext } from './driver.accessor.batch';

jest.setTimeout(15000);

describe('FirestoreCollection', () => {

  adminTestWithMockItemCollection((f) => {

    let firestore: Firestore;
    let firestoreCollection: MockItemFirestoreCollection;

    beforeEach(() => {
      firestore = f.parent.firestore as Firestore;
      firestoreCollection = f.instance.firestoreCollection;
    });

    describe('makeFirestoreCollection()', () => {

      it('should create a new collection.', () => {
        const itemsPerPage = 50;

        firestoreCollection = makeFirestoreCollection({
          firestoreContext: f.parent.context,
          itemsPerPage,
          collection: mockItemCollectionReference(f.parent.context),
          makeDocument: (a, d) => new MockItemDocument(a, d),
          ...googleCloudFirestoreDrivers()
        });

        expect(firestoreCollection).toBeDefined();
        expect(firestoreCollection.config.itemsPerPage).toBe(itemsPerPage);
      });

    });

    describe('documentAccessor()', () => {

      it('should create a new document accessor instance when no context is passed.', () => {
        const result = firestoreCollection.documentAccessor();
        expect(result).toBeDefined();
      });

      // TODO: Uncomment this later. Transaction tests are acting weird.
      it.skip('should create a new document accessor instance that uses the passed transaction context.', async () => {

        let ref: Maybe<DocumentReference<MockItem>>;

        await firestore.runTransaction(async (transaction: Transaction) => {

          const context: FirestoreDocumentContext<MockItem> = transactionDocumentContext(transaction);
          const result = firestoreCollection.documentAccessor(context);
          expect(result).toBeDefined();

          const document = result.newDocument();
          ref = document.documentRef as DocumentReference<MockItem>;

          expect(document.documentRef).toBeDefined();
          expect(document.accessor).toBeDefined();

          await document.accessor.set({ test: true });
        });

        expect(ref).toBeDefined();

        const loadedDoc = firestoreCollection.documentAccessor().loadDocument(ref!);
        const loadedData: DocumentSnapshot<MockItem> = await loadedDoc.accessor.get() as DocumentSnapshot<MockItem>;

        expect(loadedData).toBeDefined();
        expect(loadedData.data()).toBeDefined();
        expect(loadedData.data()?.test).toBe(true);
      });

      it('should create a new document accessor instance that uses the passed batch context.', async () => {

        let ref: Maybe<DocumentReference<MockItem>>;

        const batch = firestore.batch();
        const context: FirestoreDocumentContext<MockItem> = writeBatchDocumentContext(batch);

        const result = firestoreCollection.documentAccessor(context);
        expect(result).toBeDefined();

        const document = result.newDocument();
        ref = document.documentRef as DocumentReference<MockItem>;

        expect(document.documentRef).toBeDefined();
        expect(document.accessor).toBeDefined();

        await document.accessor.set({ test: true });

        expect(ref).toBeDefined();

        // Should not exist yet as the batch is not complete.
        let exists: boolean = await document.accessor.exists();
        expect(exists).toBe(false);

        await batch.commit();

        exists = await document.accessor.exists();
        expect(exists).toBe(true);

      });

    });

  });

});
