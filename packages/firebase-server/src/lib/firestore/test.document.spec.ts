import { DocumentSnapshot } from '@google-cloud/firestore';
import { MockItem, MockItemDocument, MockItemFirestoreCollection, testItemFirestoreCollection, authorizedTestWithMockItemCollection, FirestoreDocumentAccessor } from '@dereekb/firebase';
import { adminTestWithMockItemCollection } from '../../test/firestore.fixture.admin';

describe('FirestoreDocumentAccessorInstance', () => {

  adminTestWithMockItemCollection((f) => {

    let firestoreCollection: MockItemFirestoreCollection;
    let documentAccessor: FirestoreDocumentAccessor<MockItem, MockItemDocument>;

    beforeEach(async () => {
      firestoreCollection = testItemFirestoreCollection(f.parent.context);
      documentAccessor = firestoreCollection.documentAccessor();
    });

    describe('newDocument()', () => {

      it('should create a new document.', async () => {
        const document = documentAccessor.newDocument();
        expect(document).toBeDefined();

        const snapshot = await document.accessor.get() as DocumentSnapshot<MockItem>;
        expect(snapshot).toBeDefined();
        expect(snapshot.exists).toBe(false);
      });

    });

    describe('loadDocument()', () => {

      it('should load a document.', async () => {
        const newDocument = documentAccessor.newDocument();
        await newDocument.accessor.set({});

        const document = documentAccessor.loadDocument(newDocument.documentRef);
        expect(document).toBeDefined();

        const snapshot = await document.accessor.get() as DocumentSnapshot<MockItem>;
        expect(snapshot).toBeDefined();
        expect(snapshot.exists).toBe(true);
      });

    });

    describe('loadDocumentFrom()', () => {

      it('should load a document from another.', async () => {
        const newDocument = documentAccessor.newDocument();
        await newDocument.accessor.set({});

        const document = documentAccessor.loadDocumentFrom(newDocument);
        expect(document).toBeDefined();

        const snapshot = await document.accessor.get() as DocumentSnapshot<MockItem>;
        expect(snapshot).toBeDefined();
        expect(snapshot.exists).toBe(true);
      });

    });

  });

});
