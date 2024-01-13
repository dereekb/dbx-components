import { type DocumentSnapshot } from '@google-cloud/firestore';
import { type MockItem, type MockItemDocument, type MockItemFirestoreCollection, mockItemFirestoreCollection } from '@dereekb/firebase/test';
import { dbxComponentsAdminTestWithMockItemCollection } from '@dereekb/firebase-server/test';
import { type FirestoreDocumentAccessor } from '@dereekb/firebase';

describe('FirestoreDocumentAccessor', () => {
  dbxComponentsAdminTestWithMockItemCollection((f) => {
    let firestoreCollection: MockItemFirestoreCollection;
    let documentAccessor: FirestoreDocumentAccessor<MockItem, MockItemDocument>;

    beforeEach(async () => {
      firestoreCollection = mockItemFirestoreCollection(f.parent.firestoreContext);
      documentAccessor = firestoreCollection.documentAccessor();
    });

    describe('newDocument()', () => {
      it('should create a new document.', async () => {
        const document = documentAccessor.newDocument();
        expect(document).toBeDefined();

        const snapshot = (await document.accessor.get()) as DocumentSnapshot<MockItem>;
        expect(snapshot).toBeDefined();
        expect(snapshot.exists).toBe(false);
      });
    });

    describe('loadDocument()', () => {
      it('should load a document.', async () => {
        const newDocument = documentAccessor.newDocument();
        await newDocument.accessor.set({ test: true });

        const document = documentAccessor.loadDocument(newDocument.documentRef);
        expect(document).toBeDefined();

        const snapshot = (await document.accessor.get()) as DocumentSnapshot<MockItem>;
        expect(snapshot).toBeDefined();
        expect(snapshot.exists).toBe(true);
      });
    });

    describe('loadDocumentFrom()', () => {
      it('should load a document from another.', async () => {
        const newDocument = documentAccessor.newDocument();
        await newDocument.accessor.set({ test: true });

        const document = documentAccessor.loadDocumentFrom(newDocument);
        expect(document).toBeDefined();

        const snapshot = (await document.accessor.get()) as DocumentSnapshot<MockItem>;
        expect(snapshot).toBeDefined();
        expect(snapshot.exists).toBe(true);
      });
    });
  });
});
