import { authorizedTestWithMockItemCollection, type MockItem, type MockItemDocument, type MockItemFirestoreCollection } from '@dereekb/firebase/test';
import { first } from 'rxjs';
import { AbstractDbxFirebaseCollectionStore } from './store.collection';

export class TestDbxFirebaseCollectionStore extends AbstractDbxFirebaseCollectionStore<MockItem, MockItemDocument> {
  constructor(firestoreCollection: MockItemFirestoreCollection) {
    super({ firestoreCollection });
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
      describe('collectionMode', () => {
        describe('query', () => {
          it('should return the loader.', (done) => {
            store.loader$.pipe(first()).subscribe((loader) => {
              expect(loader).toBeDefined();

              loader.collectionMode$.pipe(first()).subscribe((mode) => {
                expect(mode).toBe('query');
                done();
              });
            });
          });
        });

        describe('references', () => {
          it('should return the loader.', (done) => {
            store.setCollectionMode('references');

            store.loader$.pipe(first()).subscribe((loader) => {
              expect(loader).toBeDefined();

              loader.collectionMode$.pipe(first()).subscribe((mode) => {
                expect(mode).toBe('references');
                done();
              });
            });
          });
        });
      });
    });
  });
});
