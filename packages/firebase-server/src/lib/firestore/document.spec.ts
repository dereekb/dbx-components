import { Firestore } from '@google-cloud/firestore';
import { TestItem, TestItemDocument, TestItemFirestoreCollection, testItemFirestoreCollection } from "../../test/firebase.context.item";
import { authorizedTestWithTestItemCollection } from '../../test/firebase.context.item.fixture';
import { FirestoreDocumentAccessor } from './document';

describe('FirestoreDocumentAccessorInstance', () => {

  authorizedTestWithTestItemCollection((f) => {

    let firestore: Firestore;
    let firestoreCollection: TestItemFirestoreCollection;
    let documentAccessor: FirestoreDocumentAccessor<TestItem, TestItemDocument>;

    beforeEach(async () => {
      firestore = f.parent.firestore;
      firestoreCollection = testItemFirestoreCollection(firestore);
      documentAccessor = firestoreCollection.documentAccessor();
    });

    describe('newDocument()', () => {

      it('should create a new document.', async () => {
        const document = documentAccessor.newDocument();
        expect(document).toBeDefined();

        const snapshot = await document.accessor.get();
        expect(snapshot).toBeDefined();
        expect(snapshot.exists()).toBe(false);
      });

    });

    describe('loadDocument()', () => {

      it('should load a document.', async () => {
        const newDocument = documentAccessor.newDocument();
        await newDocument.accessor.set({});

        const document = documentAccessor.loadDocument(newDocument.documentRef);
        expect(document).toBeDefined();

        const snapshot = await document.accessor.get();
        expect(snapshot).toBeDefined();
        expect(snapshot.exists()).toBe(true);
      });

    });

    describe('loadDocumentFrom()', () => {

      it('should load a document from another.', async () => {
        const newDocument = documentAccessor.newDocument();
        await newDocument.accessor.set({});

        const document = documentAccessor.loadDocumentFrom(newDocument);
        expect(document).toBeDefined();

        const snapshot = await document.accessor.get();
        expect(snapshot).toBeDefined();
        expect(snapshot.exists()).toBe(true);
      });

    });

  });

});
