import { DocumentReference, runTransaction, Transaction, Firestore } from '@firebase/firestore';
import { makeFirestoreCollection } from '../../common/firestore/firestore';
import { TestItem, testItemCollectionReference, TestItemDocument, TestItemFirestoreCollection, testItemFirestoreCollection } from "../../../test/firebase.context.item";
import { authorizedTestWithTestItemCollection } from "../../../test/firebase.context.item.fixture";
import { FirestoreDocumentContext } from './context';
import { transactionDocumentContext } from './context.transaction';
import { Maybe } from '@dereekb/util';

describe('FirestoreCollection', () => {

  authorizedTestWithTestItemCollection((f) => {

    let firestore: Firestore;
    let firestoreCollection: TestItemFirestoreCollection;

    beforeEach(async () => {
      firestore = f.parent.firestore;
    });

    describe('makeFirestoreCollection()', () => {

      it('should create a new collection.', () => {
        const itemsPerPage = 50;

        firestoreCollection = makeFirestoreCollection({
          itemsPerPage,
          collection: testItemCollectionReference(firestore),
          makeDocument: (a, d) => new TestItemDocument(a, d)
        });

        expect(firestoreCollection).toBeDefined();
        expect(firestoreCollection.config.itemsPerPage).toBe(itemsPerPage);
      });

    });

    beforeEach(async () => {
      firestoreCollection = testItemFirestoreCollection(firestore);
    });

    describe('documentAccessor()', () => {

      it('should create a new document accessor instance when no context is passed.', () => {
        const result = firestoreCollection.documentAccessor();
        expect(result).toBeDefined();
      });

      it('should create a new document accessor instance that uses the passed context.', async () => {

        let ref: Maybe<DocumentReference<TestItem>>;

        await runTransaction(firestore, async (transaction: Transaction) => {

          const context: FirestoreDocumentContext<TestItem> = transactionDocumentContext(transaction);
          const result = firestoreCollection.documentAccessor(context);
          expect(result).toBeDefined();

          const document = result.newDocument();
          ref = document.documentRef;

          expect(document.documentRef).toBeDefined();
          expect(document.accessor).toBeDefined();

          await document.accessor.set({ test: true });
        });

        expect(ref).toBeDefined();

        const loadedDoc = firestoreCollection.documentAccessor().loadDocument(ref!);
        const loadedData = await loadedDoc.accessor.get();

        expect(loadedData.exists()).toBe(true);
      });

    });

  });

});
