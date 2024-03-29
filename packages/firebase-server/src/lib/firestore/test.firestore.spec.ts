import { type DocumentReference, type Transaction, type Firestore } from '@google-cloud/firestore';
import { type DocumentSnapshot, makeFirestoreCollection } from '@dereekb/firebase';
import { mockItemIdentity, type MockItem, mockItemCollectionReference, MockItemDocument, type MockItemFirestoreCollection, mockItemConverter } from '@dereekb/firebase/test';
import { type Maybe } from '@dereekb/util';
import { dbxComponentsAdminTestWithMockItemCollection } from '@dereekb/firebase-server/test';
import { googleCloudFirestoreDrivers } from './driver';

describe('FirestoreCollection', () => {
  dbxComponentsAdminTestWithMockItemCollection((f) => {
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
          converter: mockItemConverter,
          modelIdentity: mockItemIdentity,
          firestoreContext: f.parent.firestoreContext,
          itemsPerPage,
          collection: mockItemCollectionReference(f.parent.firestoreContext),
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

      it('should create a new document accessor instance that uses the passed transaction context.', async () => {
        let ref: DocumentReference<MockItem>;

        // The only reason we would do this type of function in a transaction is for a specific item that should not exist yet.
        const specificIdentifier = 'test';

        await firestore.runTransaction(async (transaction: Transaction) => {
          const documentAccessor = firestoreCollection.documentAccessorForTransaction(transaction);

          const document = documentAccessor.loadDocumentForId(specificIdentifier);
          ref = document.documentRef as DocumentReference<MockItem>;

          const exists = await document.accessor.exists(); // don't create if it exists
          expect(exists).toBe(false);

          await document.accessor.set({ test: true });
        });

        expect(ref!).toBeDefined();

        const loadedDoc = firestoreCollection.documentAccessor().loadDocument(ref!);
        const loadedData: DocumentSnapshot<MockItem> = (await loadedDoc.accessor.get()) as DocumentSnapshot<MockItem>;

        expect(loadedData).toBeDefined();
        expect(loadedData.data()).toBeDefined();
        expect(loadedData.data()?.test).toBe(true);
      });

      it('should create a new document accessor instance that uses the passed batch context.', async () => {
        const batch = firestore.batch();
        const result = firestoreCollection.documentAccessorForWriteBatch(batch);
        expect(result).toBeDefined();

        const document = result.newDocument();
        const ref: Maybe<DocumentReference<MockItem>> = document.documentRef as DocumentReference<MockItem>;

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
