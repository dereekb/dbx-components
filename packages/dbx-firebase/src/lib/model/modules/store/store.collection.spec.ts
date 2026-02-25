import { authorizedTestWithMockItemCollection, MockItemCollections, type MockItem, type MockItemDocument } from '@dereekb/firebase/test';
import { first } from 'rxjs';
import { AbstractDbxFirebaseCollectionStore } from './store.collection';
import { callbackTest } from '@dereekb/util/test';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { newWithInjector } from '@dereekb/dbx-core';
import { inject, Injectable, Injector } from '@angular/core';

@Injectable()
export class TestDbxFirebaseCollectionStore extends AbstractDbxFirebaseCollectionStore<MockItem, MockItemDocument> {
  constructor() {
    super({ firestoreCollection: inject(MockItemCollections).mockItemCollection });
  }
}

describe('AbstractDbxFirebaseCollectionStore', () => {
  authorizedTestWithMockItemCollection((f) => {
    let store: TestDbxFirebaseCollectionStore;

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
      store = newWithInjector(TestDbxFirebaseCollectionStore, injector);
    });

    afterEach(() => {
      store._destroyNow();
      TestBed.resetTestingModule();
    });

    describe('loader$', () => {
      describe('collectionMode', () => {
        describe('query', () => {
          it(
            'should return the loader.',
            callbackTest((done) => {
              store.loader$.pipe(first()).subscribe((loader) => {
                expect(loader).toBeDefined();

                loader.collectionMode$.pipe(first()).subscribe((mode) => {
                  expect(mode).toBe('query');
                  done();
                });
              });
            })
          );
        });

        describe('references', () => {
          it(
            'should return the loader.',
            callbackTest((done) => {
              store.setCollectionMode('references');

              store.loader$.pipe(first()).subscribe((loader) => {
                expect(loader).toBeDefined();

                loader.collectionMode$.pipe(first()).subscribe((mode) => {
                  expect(mode).toBe('references');
                  done();
                });
              });
            })
          );
        });
      });
    });
  });
});
