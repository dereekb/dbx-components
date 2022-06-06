import { Injectable } from '@angular/core';
import { DocumentReference } from '@dereekb/firebase';
import { authorizedTestWithMockItemCollection, MockItem, MockItemDocument, MockItemFirestoreCollection } from '@dereekb/firebase/test';
import { loadingStateIsLoading, SubscriptionObject } from '@dereekb/rxjs';
import { first, of, timeout } from 'rxjs';
import { AbstractDbxFirebaseDocumentStore } from './store.document';

@Injectable()
export class TestDbxFirebaseDocumentStore extends AbstractDbxFirebaseDocumentStore<MockItem, MockItemDocument> {
  constructor(firestoreCollection: MockItemFirestoreCollection) {
    super({ firestoreCollection });
  }
}

describe('AbstractDbxFirebaseDocumentStore', () => {
  authorizedTestWithMockItemCollection((f) => {
    let sub: SubscriptionObject;
    let store: TestDbxFirebaseDocumentStore;

    beforeEach(() => {
      const firestoreCollection = f.instance.firestoreCollection;
      sub = new SubscriptionObject();
      store = new TestDbxFirebaseDocumentStore(firestoreCollection);
    });

    afterEach(() => {
      sub.destroy();
      store._destroyNow();
    });

    describe('loading a document', () => {
      describe('setId', () => {
        it('should load the document with the input id.', (done) => {
          const id = 'test';

          store.setId(id);

          sub.subscription = store.document$.pipe(first()).subscribe((document) => {
            expect(document).toBeDefined();
            done();
          });
        });
      });

      describe('setRef', () => {
        let ref: DocumentReference<MockItem>;

        beforeEach(() => {
          const doc = f.instance.firestoreCollection.documentAccessor().loadDocumentForId('test');
          ref = doc.documentRef;
        });

        it('should load the document with the input ref.', (done) => {
          store.setRef(ref);

          sub.subscription = store.document$.pipe(first()).subscribe((document) => {
            expect(document).toBeDefined();
            expect(document.documentRef).toBe(ref);
            done();
          });
        });
      });

      it('should not load anything if neither id nor ref are set.', (done) => {
        const sub: SubscriptionObject = new SubscriptionObject();

        sub.subscription = store.document$.pipe(timeout({ first: 100, with: () => of(false) }), first()).subscribe((result) => {
          expect(result).toBe(false);
          sub.destroy();
          store.ngOnDestroy();

          store.state$.pipe();
          done();
        });
      });
    });

    describe('reading the document', () => {
      describe('before loading the document', () => {
        it('documentLoadingState$ should be loading.', (done) => {
          sub.subscription = store.documentLoadingState$.pipe(first()).subscribe((x) => {
            expect(loadingStateIsLoading(x)).toBe(true);
            done();
          });
        });

        it('snapshotLoadingState$ should be loading.', (done) => {
          sub.subscription = store.snapshotLoadingState$.pipe(first()).subscribe((x) => {
            expect(loadingStateIsLoading(x)).toBe(true);
            done();
          });
        });

        it('dataLoadingState$ should be loading.', (done) => {
          sub.subscription = store.dataLoadingState$.pipe(first()).subscribe((x) => {
            expect(loadingStateIsLoading(x)).toBe(true);
            done();
          });
        });
      });

      // TODO: The jest environment must be set to node for the firebase components to work, but setting the environment to jest causes issues with ngzone somehow.
      // TODO: Need to figure out the right combination in order to make the environment not encounter issues.
      /**
       * @jest-environment node
       */
      // use the node environment, as the jsdom environment breaks for tests that use the firestore.

      /*
    describe('after loading the document', () => {
      let testDoc: MockItemDocument;

      beforeEach(async () => {
        testDoc = f.instance.firestoreCollection.documentAccessor().newDocument();
        store.setRef(testDoc.documentRef);
      });

      it('documentLoadingState$ should have a document.', (done) => {

        sub.subscription = store.documentLoadingState$.pipe(first()).subscribe((x) => {
          expect(loadingStateIsLoading(x)).toBe(false);
          expect(x.value).toBeDefined();
          expect(x.value?.documentRef).toBe(testDoc.documentRef);
          done();
        });

      });

      it('snapshotLoadingState$ should have a snapshot.', (done) => {

        sub.subscription = store.snapshotLoadingState$.pipe(filter(x => !loadingStateIsLoading(x)), first()).subscribe((x) => {
          expect(loadingStateIsLoading(x)).toBe(false);
          expect(x.value).toBeDefined();
          expect(x.value?.id).toBe(testDoc.id);
          done();
        });

      });

      describe('document does not exists', () => {

        beforeEach(async () => {
          await testDoc.accessor.delete();
        });

        it('should not exist', (done) => {

          sub.subscription = store.exists$.pipe(first()).subscribe((exists) => {
            expect(exists).toBe(false);
            done();
          });

        });

        it('dataLoadingState$ should return an error state.', (done) => {

          sub.subscription = store.dataLoadingState$.pipe(filter(x => !loadingStateIsLoading(x)), first()).subscribe({
            next: (state) => {
              expect(state.error).toBeDefined();
              done();
            }
          });

        });

      });

      describe('document exists', () => {

        it('should exist', (done) => {

          sub.subscription = store.exists$.pipe(first()).subscribe((exists) => {
            expect(exists).toBe(true);
            done();
          });

        });

        it('dataLoadingState$ should return a success state', (done) => {

          sub.subscription = store.dataLoadingState$.pipe(filter(x => !loadingStateIsLoading(x)), first()).subscribe({
            next: (state) => {
              expect(state.value).toBeDefined();
              expect(state.value?.test).toBe(testValue);
              done();
            }
          });

        });

      });

    });

    */
    });
  });
});
