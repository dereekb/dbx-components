import { type DocumentSnapshot } from '@google-cloud/firestore';
import { first } from 'rxjs';
import { type FirestoreDocumentAccessor } from '@dereekb/firebase';
import { type MockItem, type MockItemDocument, type MockItemFirestoreCollection, mockItemFirestoreCollection } from '@dereekb/firebase/test';
import { dbxComponentsAdminTestWithMockItemCollection } from '@dereekb/firebase-server/test';

describe('FirestoreDocumentDataAccessor', () => {
  dbxComponentsAdminTestWithMockItemCollection((f) => {
    let firestoreCollection: MockItemFirestoreCollection;
    let documentAccessor: FirestoreDocumentAccessor<MockItem, MockItemDocument>;
    let document: MockItemDocument;

    beforeEach(async () => {
      firestoreCollection = mockItemFirestoreCollection(f.parent.firestoreContext);
      documentAccessor = firestoreCollection.documentAccessor();
      document = documentAccessor.newDocument();
    });

    describe('get()', () => {
      it('should return a document snapshot even if the item does not exist.', async () => {
        const document = documentAccessor.newDocument();
        expect(document).toBeDefined();

        const snapshot = (await document.accessor.get()) as DocumentSnapshot<MockItem>;
        expect(snapshot).toBeDefined();
        expect(snapshot.exists).toBe(false);
      });
    });

    describe('stream()', () => {
      it('should return a document snapshot even if the item does not exist.', (done) => {
        const document = documentAccessor.newDocument();
        expect(document).toBeDefined();

        document.accessor
          .stream()
          .pipe(first())
          .subscribe((snapshot) => {
            expect(snapshot).toBeDefined();
            expect((snapshot as DocumentSnapshot<MockItem>).exists).toBe(false);
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
          document.accessor
            .stream()
            .pipe(first())
            .subscribe((snapshot) => {
              expect(snapshot).toBeDefined();
              expect((snapshot as DocumentSnapshot<MockItem>).exists).toBe(true);
              done();
            });
        });
      });

      describe('get()', () => {
        it('should return the document snapshot.', async () => {
          const snapshot = await document.accessor.get();
          expect(snapshot).toBeDefined();
          expect((snapshot as DocumentSnapshot<MockItem>).exists).toBe(true);
        });
      });

      describe('delete()', () => {
        it(`should delete the document.`, async () => {
          let snapshot = (await document.accessor.get()) as DocumentSnapshot<MockItem>;
          expect(snapshot.exists).toBe(true);

          await document.accessor.delete();

          snapshot = (await document.accessor.get()) as DocumentSnapshot<MockItem>;
          expect(snapshot.exists).toBe(false);
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

        it(`should merge in partial data when merge is true`, async () => {
          const test = true;
          const value = 'test';

          // create object
          await document.accessor.set({
            test
          });

          // update it via set
          await document.accessor.set(
            {
              value
            },
            {
              merge: true
            }
          );

          const snapshot = await document.accessor.get();
          const data = snapshot.data()!;

          expect(data.test).toBe(test);
          expect(data.value).toBe(value);
        });

        it(`should create the object if it doesn't exist when merge is true`, async () => {
          await document.accessor.delete();

          const test = true;
          const value = 'test';

          const exists = await document.accessor.exists();
          expect(exists).toBe(false);

          // create it via set w/ merge
          await document.accessor.set(
            {
              test,
              value
            },
            {
              merge: true
            }
          );

          const snapshot = await document.accessor.get();
          const data = snapshot.data()!;

          expect(data.value).toBe(value);
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
