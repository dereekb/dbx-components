import { authorizedTestWithMockItemCollection, MockItem, MockItemDocument, MockItemFirestoreCollection } from "@dereekb/firebase";
import { first } from "rxjs";
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
      store._destroyNow();
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
