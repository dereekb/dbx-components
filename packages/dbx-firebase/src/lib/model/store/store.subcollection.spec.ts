import { Injectable } from "@angular/core";
import { MockItemSubItem, MockItemSubItemDocument, authorizedTestWithMockItemCollection, MockItem, MockItemDocument, MockItemFirestoreCollection, MockItemSubItemFirestoreCollectionFactory } from "@dereekb/firebase/test";
import { SubscriptionObject } from "@dereekb/rxjs";
import { filter, first, of, timeout } from "rxjs";
import { AbstractDbxFirebaseDocumentStore } from "./store.document";
import { AbstractDbxFirebaseCollectionWithParentStore } from './store.subcollection';

@Injectable()
export class TestDbxFirebaseDocumentStore extends AbstractDbxFirebaseDocumentStore<MockItem, MockItemDocument> {

  constructor(firestoreCollection: MockItemFirestoreCollection) {
    super({ firestoreCollection })
  }

}

@Injectable()
export class TestDbxFirebaseCollectionWithParentStore extends AbstractDbxFirebaseCollectionWithParentStore<MockItemSubItem, MockItem, MockItemSubItemDocument, MockItemDocument> {

  constructor(collectionFactory: MockItemSubItemFirestoreCollectionFactory) {
    super({ collectionFactory });
  }

}

describe('AbstractDbxFirebaseCollectionWithParentStore', () => {

  authorizedTestWithMockItemCollection((f) => {

    let sub: SubscriptionObject;
    let parentStore: TestDbxFirebaseDocumentStore;
    let store: TestDbxFirebaseCollectionWithParentStore;

    beforeEach(() => {
      const firestoreCollection = f.instance.firestoreCollection;
      parentStore = new TestDbxFirebaseDocumentStore(firestoreCollection);
      store = new TestDbxFirebaseCollectionWithParentStore(f.instance.mockItemSubItemCollection);
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
        sub.subscription = store.firestoreIteration$.pipe(timeout({ first: 500, with: () => of(false) }), first()).subscribe((result) => {
          expect(result).toBe(false);
          done();
        });
      });

      describe('with parent loaded', () => {

        beforeEach(() => {
          parentStore.setId('test');
        });

        it('should load the iterator.', (done) => {
          sub.subscription = store.firestoreIteration$.pipe(first()).subscribe((iteration) => {
            expect(iteration).toBeDefined();
            done();
          });
        });

      });

    });

    describe('loader$', () => {

      describe('with parent loaded', () => {

        beforeEach(() => {
          parentStore.setId('test');
        });

        it('should change when the parent store changes.', (done) => {
          store.loader$.pipe(first()).subscribe((initialLoader) => {
            store.setParentStore(parentStore);

            sub.subscription = store.loader$.pipe(filter(x => x !== initialLoader)).subscribe((loader) => {
              expect(loader).toBeDefined();
              done();
            });

          });

        });

        it('should change when the loaded parent changes.', (done) => {
          store.setParentStore(parentStore);

          store.loader$.pipe(first()).subscribe((initialLoader) => {
            parentStore.setId('secondtest');

            sub.subscription = store.loader$.pipe(filter(x => x !== initialLoader)).subscribe((loader) => {
              expect(loader).toBeDefined();
              done();
            });

          });

        });

      });

    });

  });

});
