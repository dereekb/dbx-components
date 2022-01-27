import { Firestore } from '@firebase/firestore';
import { FirestoreCollection, makeFirestoreCollection } from './firestore';
import { authorizedTestWithTestItemCollection, TestItem, testItemCollection, TestItemDocument } from "../../test/firebase.context.item";

describe('FirestoreCollection', () => {

  authorizedTestWithTestItemCollection((f) => {

    let firestore: Firestore;
    let firestoreCollection: FirestoreCollection<TestItem, TestItemDocument>;

    beforeEach(async () => {
      firestore = f.parent.firestore;
      firestoreCollection = makeFirestoreCollection({
        itemsPerPage: 50,
        collection: testItemCollection(firestore),
        makeDocument: (x) => new TestItemDocument(x.documentRef)
      });
    });

    describe('makeFirestoreCollection()', () => {

      it('should create a new collection.', () => {

        firestoreCollection = makeFirestoreCollection({
          itemsPerPage: 1,
          collection: testItemCollection(firestore),
          makeDocument: (x) => new TestItemDocument(x.documentRef)
        });

        expect(firestoreCollection).toBeDefined();
      });

    });

    describe('testItemCollection', () => {

      it('should create a new document', () => {

        // TODO:

      });

    });
  });

});
