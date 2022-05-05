/**
 * @jest-environment node
 */
// use the node environment, as the jsdom environment breaks for tests that use the firestore.

import { MockItemSubItem, MockItemSubItemDocument, authorizedTestWithMockItemCollection, MockItem, MockItemDocument, MockItemFirestoreCollection, MockItemSubItemFirestoreCollectionFactory } from "@dereekb/firebase";
import { SubscriptionObject } from "@dereekb/rxjs";
import { filter, first, of, timeout } from "rxjs";
import { AbstractDbxFirebaseDocumentStore } from "./store.document";
import { AbstractDbxFirebaseDocumentWithParentStore } from './store.subcollection.document';

export class TestDbxFirebaseDocumentStore extends AbstractDbxFirebaseDocumentStore<MockItem, MockItemDocument> {

  constructor(firestoreCollection: MockItemFirestoreCollection) {
    super({ firestoreCollection })
  }

}

export class TestDbxFirebaseDocumentWithParentStore extends AbstractDbxFirebaseDocumentWithParentStore<MockItemSubItem, MockItem, MockItemSubItemDocument, MockItemDocument> {

  constructor(collectionFactory: MockItemSubItemFirestoreCollectionFactory) {
    super({ collectionFactory })
  }

}

describe('AbstractDbxFirebaseCollectionWithParentStore', () => {

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
      parentStore.ngOnDestroy();
      store.ngOnDestroy();
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
          sub.subscription = store.document$.pipe(first()).subscribe((iteration) => {
            expect(iteration).toBeDefined();
            done();
          });
        });

      });

    });

  });

});
