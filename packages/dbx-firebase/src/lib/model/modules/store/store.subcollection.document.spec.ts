import { Injectable } from '@angular/core';
import { MockItemSubItem, MockItemSubItemDocument, authorizedTestWithMockItemCollection, MockItem, MockItemDocument, MockItemFirestoreCollection, MockItemSubItemFirestoreCollectionFactory } from '@dereekb/firebase/test';
import { SubscriptionObject } from '@dereekb/rxjs';
import { first, of, timeout } from 'rxjs';
import { AbstractDbxFirebaseDocumentStore } from './store.document';
import { AbstractDbxFirebaseDocumentWithParentStore } from './store.subcollection.document';

@Injectable()
export class TestDbxFirebaseDocumentStore extends AbstractDbxFirebaseDocumentStore<MockItem, MockItemDocument> {
  constructor(firestoreCollection: MockItemFirestoreCollection) {
    super({ firestoreCollection });
  }
}

@Injectable()
export class TestDbxFirebaseDocumentWithParentStore extends AbstractDbxFirebaseDocumentWithParentStore<MockItemSubItem, MockItem, MockItemSubItemDocument, MockItemDocument> {
  constructor(collectionFactory: MockItemSubItemFirestoreCollectionFactory) {
    super({ collectionFactory });
  }
}

describe('AbstractDbxFirebaseDocumentWithParentStore', () => {
  authorizedTestWithMockItemCollection((f) => {
    let sub: SubscriptionObject;
    let parentStore: TestDbxFirebaseDocumentStore;
    let store: TestDbxFirebaseDocumentWithParentStore;

    beforeEach(() => {
      const firestoreCollection = f.instance.firestoreCollection;
      parentStore = new TestDbxFirebaseDocumentStore(firestoreCollection);
      store = new TestDbxFirebaseDocumentWithParentStore(f.instance.mockItemSubItemCollection);
      sub = new SubscriptionObject();
    });

    afterEach(() => {
      parentStore._destroyNow();
      store._destroyNow();
      sub.destroy();
    });

    describe('with parent store', () => {
      beforeEach(() => {
        store.setParentStore(parentStore);
      });

      it('should not load while a parent is not set.', (done) => {
        sub.subscription = store.document$.pipe(timeout({ first: 500, with: () => of(false) }), first()).subscribe((result) => {
          expect(result).toBe(false);
          done();
        });
      });

      describe('with parent loaded', () => {
        beforeEach(() => {
          parentStore.setId('test');
        });

        it('should load the document.', (done) => {
          store.setId('test');

          sub.subscription = store.document$.pipe(first()).subscribe((iteration) => {
            expect(iteration).toBeDefined();
            done();
          });
        });
      });
    });
  });
});
