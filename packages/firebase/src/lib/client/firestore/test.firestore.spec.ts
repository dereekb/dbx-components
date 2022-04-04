import { DocumentSnapshot, DocumentReference, runTransaction, Transaction, Firestore, writeBatch } from '@firebase/firestore';
import { MockItem, testItemCollectionReference, MockItemDocument, MockItemFirestoreCollection, testItemFirestoreCollection, authorizedTestWithMockItemCollection } from "../../../test";
import { FirestoreDocumentContext, makeFirestoreCollection } from "../../common/firestore";
import { transactionDocumentContext } from './driver.accessor.transaction';
import { Maybe } from '@dereekb/util';
import { firebaseFirestoreClientDrivers } from './driver';
import { writeBatchDocumentContext } from './driver.accessor.batch';

describe('FirestoreCollection', () => {

  authorizedTestWithMockItemCollection((f) => {

    let firestore: Firestore;
    let firestoreCollection: MockItemFirestoreCollection;

    beforeEach(async () => {
      firestore = f.parent.firestore as Firestore;
    });

    describe('makeFirestoreCollection()', () => {

      it('should create a new collection.', () => {
        const itemsPerPage = 50;

        firestoreCollection = makeFirestoreCollection({
          firestoreContext: f.parent.context,
          itemsPerPage,
          collection: testItemCollectionReference(f.parent.context),
          makeDocument: (a, d) => new MockItemDocument(a, d),
          ...firebaseFirestoreClientDrivers()
        });

        expect(firestoreCollection).toBeDefined();
        expect(firestoreCollection.config.itemsPerPage).toBe(itemsPerPage);
      });

    });

    beforeEach(async () => {
      firestoreCollection = testItemFirestoreCollection(f.parent.context);
    });

    describe('documentAccessor()', () => {

      it('should create a new document accessor instance when no context is passed.', () => {
        const result = firestoreCollection.documentAccessor();
        expect(result).toBeDefined();
      });

      it('should create a new document accessor instance that uses the passed transaction context.', async () => {

        let ref: Maybe<DocumentReference<MockItem>>;

        await runTransaction(firestore, async (transaction: Transaction) => {

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

        expect(loadedData.exists()).toBe(true);
      });

      it('should create a new document accessor instance that uses the passed batch context.', async () => {

        let ref: Maybe<DocumentReference<MockItem>>;

        const batch = writeBatch(firestore);
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
