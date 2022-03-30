import { Firestore } from '@firebase/firestore';
import { first } from 'rxjs';
import { TestItem, TestItemDocument, TestItemFirestoreCollection, testItemFirestoreCollection } from "../../../test/firebase.context.item";
import { authorizedTestWithTestItemCollection } from "../../../test/firebase.context.item.fixture";
import { FirestoreDocumentAccessor } from './document';

describe('FirestoreDocumentDataAccessor', () => {

  authorizedTestWithTestItemCollection((f) => {

    let firestore: Firestore;
    let firestoreCollection: TestItemFirestoreCollection;
    let documentAccessor: FirestoreDocumentAccessor<TestItem, TestItemDocument>;
    let document: TestItemDocument;

    beforeEach(async () => {
      firestore = f.parent.firestore;
      firestoreCollection = testItemFirestoreCollection(firestore);
      documentAccessor = firestoreCollection.documentAccessor();
      document = documentAccessor.newDocument();
    });

    describe('get()', () => {

      it('should return a document snapshot even if the item does not exist.', async () => {
        const document = documentAccessor.newDocument();
        expect(document).toBeDefined();

        const snapshot = await document.accessor.get();
        expect(snapshot).toBeDefined();
        expect(snapshot.exists()).toBe(false);
      });

    });

    describe('stream()', () => {

      it('should return a document snapshot even if the item does not exist.', (done) => {
        const document = documentAccessor.newDocument();
        expect(document).toBeDefined();

        document.accessor.stream().pipe(first()).subscribe((snapshot) => {
          expect(snapshot).toBeDefined();
          expect(snapshot.exists()).toBe(false);
          done();
        });
      });

    });

    describe('after creation', () => {

      beforeEach(async () => {
        await document.accessor.set({
          test: false
        });
      });

      describe('stream()', () => {

        it('should return the document snapshot.', (done) => {
          document.accessor.stream().pipe(first()).subscribe((snapshot) => {
            expect(snapshot).toBeDefined();
            expect(snapshot.exists()).toBe(true);
            done();
          });
        });

      });

      describe('get()', () => {

        it('should return the document snapshot.', async () => {
          const snapshot = await document.accessor.get();
          expect(snapshot).toBeDefined();
          expect(snapshot.exists()).toBe(true);
        });

      });

      describe('delete()', () => {

        it(`should delete the document.`, async () => {
          let snapshot = await document.accessor.get();
          expect(snapshot.exists()).toBe(true);

          await document.accessor.delete();

          snapshot = await document.accessor.get();
          expect(snapshot.exists()).toBe(false);
        });

      });

      describe('set()', () => {

        it(`should set the document's data.`, async () => {
          await document.accessor.set({
            test: true
          });

          const snapshot = await document.accessor.get();
          const data = snapshot.data()!;

          expect(data.test).toBe(true);
        });

      });

      describe('update()', () => {

        it(`should update the document's data.`, async () => {
          const value = 'test';

          await document.accessor.update({
            value
          });

          const snapshot = await document.accessor.get();
          const data = snapshot.data()!;

          expect(data.test).toBe(false);
          expect(data.value).toBe(value);
        });

      });


    });

  });

});
