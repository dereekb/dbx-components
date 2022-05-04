/**
 * @jest-environment node
 */
// use the node environment, as the jsdom environment breaks for tests that use the firestore.

import { authorizedTestWithMockItemCollection, DocumentReference, MockItem, MockItemDocument, MockItemFirestoreCollection } from "@dereekb/firebase";
import { loadingStateIsLoading } from "@dereekb/rxjs";
import { filter, first, of, timeout } from "rxjs";
import { AbstractDbxFirebaseCollectionStore } from './store.collection';

export class TestDbxFirebaseCollectionStore extends AbstractDbxFirebaseCollectionStore<MockItem, MockItemDocument> {

  constructor(firestoreCollection: MockItemFirestoreCollection) {
    super({ firestoreCollection })
  }

}

describe('AbstractDbxFirebaseCollectionStore', () => {

  authorizedTestWithMockItemCollection((f) => {

    let store: TestDbxFirebaseCollectionStore;

    beforeEach(() => {
      const firestoreCollection = f.instance.firestoreCollection;
      store = new TestDbxFirebaseCollectionStore(firestoreCollection);
    });

    afterEach(() => {
      store.ngOnDestroy();
    });

    describe('loader$', () => {

      it('should return the loader.', (done) => {

        store.loader$.pipe(first()).subscribe((loader) => {
          expect(loader).toBeDefined();
          done();
        });

      });

    });

  });

});
