import { inject, Injectable, Injector, provideZonelessChangeDetection, runInInjectionContext } from '@angular/core';
import { MockItemSubItem, MockItemSubItemDocument, authorizedTestWithMockItemCollection, MockItem, MockItemDocument, MockItemFirestoreCollection, MockItemSubItemFirestoreCollectionFactory, MockItemCollections } from '@dereekb/firebase/test';
import { SubscriptionObject } from '@dereekb/rxjs';
import { first, of, timeout } from 'rxjs';
import { AbstractDbxFirebaseDocumentStore } from './store.document';
import { AbstractDbxFirebaseDocumentWithParentStore } from './store.subcollection.document';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { callbackTest } from '@dereekb/util/test';
import { newWithInjector } from '@dereekb/dbx-core';

@Injectable()
export class TestDbxFirebaseDocumentStore extends AbstractDbxFirebaseDocumentStore<MockItem, MockItemDocument> {
  constructor() {
    super({ firestoreCollection: inject(MockItemCollections).mockItemCollection });
  }
}

@Injectable()
export class TestDbxFirebaseDocumentWithParentStore extends AbstractDbxFirebaseDocumentWithParentStore<MockItemSubItem, MockItem, MockItemSubItemDocument, MockItemDocument> {
  constructor() {
    super({ collectionFactory: inject(MockItemCollections).mockItemSubItemCollectionFactory });
  }
}

describe('AbstractDbxFirebaseDocumentWithParentStore', () => {
  authorizedTestWithMockItemCollection((f) => {
    let sub: SubscriptionObject;
    let parentStore: TestDbxFirebaseDocumentStore;
    let store: TestDbxFirebaseDocumentWithParentStore;

    beforeEach(waitForAsync(() => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: MockItemCollections,
            useValue: f.instance.collections
          }
        ]
      });
    }));

    beforeEach(() => {
      const injector = TestBed.inject(Injector);

      store = newWithInjector(TestDbxFirebaseDocumentWithParentStore, injector);
      parentStore = newWithInjector(TestDbxFirebaseDocumentStore, injector);
      sub = new SubscriptionObject();
    });

    afterEach(() => {
      parentStore._destroyNow();
      store._destroyNow();
      sub.destroy();
      TestBed.resetTestingModule();
    });

    describe('with parent store', () => {
      beforeEach(() => {
        store.setParentStore(parentStore);
      });

      it(
        'should not load while a parent is not set.',
        callbackTest((done) => {
          sub.subscription = store.document$.pipe(timeout({ first: 500, with: () => of(false) }), first()).subscribe((result) => {
            expect(result).toBe(false);
            done();
          });
        })
      );

      describe('with parent loaded', () => {
        beforeEach(() => {
          parentStore.setId('test');
        });

        it(
          'should load the document.',
          callbackTest((done) => {
            store.setId('test');

            sub.subscription = store.document$.pipe(first()).subscribe((iteration) => {
              expect(iteration).toBeDefined();
              done();
            });
          })
        );
      });
    });
  });
});
