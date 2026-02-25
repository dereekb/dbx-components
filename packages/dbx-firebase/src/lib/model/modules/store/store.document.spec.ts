import { inject, Injectable, Injector } from '@angular/core';
import { authorizedTestWithMockItemCollection, MockItem, MockItemCollections, MockItemDocument } from '@dereekb/firebase/test';
import { DocumentReference } from '@dereekb/firebase';
import { AbstractDbxFirebaseDocumentStore } from './store.document';
import { isLoadingStateLoading, SubscriptionObject } from '@dereekb/rxjs';
import { filter, first, of, timeout } from 'rxjs';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { callbackTest } from '@dereekb/util/test';
import { newWithInjector } from '@dereekb/dbx-core';

@Injectable()
export class TestDbxFirebaseDocumentStore extends AbstractDbxFirebaseDocumentStore<MockItem, MockItemDocument> {
  constructor() {
    super({ firestoreCollection: inject(MockItemCollections).mockItemCollection });
  }
}

describe('AbstractDbxFirebaseDocumentStore', () => {
  authorizedTestWithMockItemCollection((f) => {
    let sub: SubscriptionObject;
    let store: TestDbxFirebaseDocumentStore;

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

      sub = new SubscriptionObject();
      store = newWithInjector(TestDbxFirebaseDocumentStore, injector);
    });

    afterEach(() => {
      sub.destroy();
      store._destroyNow();
      TestBed.resetTestingModule();
    });

    describe('loading a document', () => {
      describe('setId', () => {
        it(
          'should load the document with the input id.',
          callbackTest((done) => {
            const id = 'test';

            store.setId(id);

            sub.subscription = store.document$.pipe(first()).subscribe((document) => {
              expect(document).toBeDefined();
              done();
            });
          })
        );
      });

      describe('setRef', () => {
        let ref: DocumentReference<MockItem>;

        beforeEach(() => {
          const doc = f.instance.mockItemCollection.documentAccessor().loadDocumentForId('test');
          ref = doc.documentRef;
        });

        it(
          'should load the document with the input ref.',
          callbackTest((done) => {
            store.setRef(ref);

            sub.subscription = store.document$.pipe(first()).subscribe((document) => {
              expect(document).toBeDefined();
              expect(document.documentRef.path).toBe(ref.path);
              done();
            });
          })
        );
      });

      it(
        'should not load anything if neither id nor ref are set.',
        callbackTest((done) => {
          sub.subscription = store.document$.pipe(timeout({ first: 100, with: () => of(false) }), first()).subscribe((result) => {
            expect(result).toBe(false);
            sub.destroy();
            store.ngOnDestroy();

            store.state$.pipe();
            done();
          });
        })
      );
    });

    describe('reading the document', () => {
      describe('before loading the document', () => {
        it(
          'documentLoadingState$ should be loading.',
          callbackTest((done) => {
            sub.subscription = store.documentLoadingState$.pipe(first()).subscribe((x) => {
              expect(isLoadingStateLoading(x)).toBe(true);
              done();
            });
          })
        );

        it(
          'snapshotLoadingState$ should be loading.',
          callbackTest((done) => {
            sub.subscription = store.snapshotLoadingState$.pipe(first()).subscribe((x) => {
              expect(isLoadingStateLoading(x)).toBe(true);
              done();
            });
          })
        );

        it(
          'dataLoadingState$ should be loading.',
          callbackTest((done) => {
            sub.subscription = store.dataLoadingState$.pipe(first()).subscribe((x) => {
              expect(isLoadingStateLoading(x)).toBe(true);
              done();
            });
          })
        );
      });

      describe('after loading the document', () => {
        let testDoc: MockItemDocument;

        beforeEach(async () => {
          testDoc = f.instance.mockItemCollection.documentAccessor().newDocument();
          store.setRef(testDoc.documentRef);
        });

        it(
          'documentLoadingState$ should have a document.',
          callbackTest((done) => {
            sub.subscription = store.documentLoadingState$.pipe(first()).subscribe((x) => {
              expect(isLoadingStateLoading(x)).toBe(false);
              expect(x.value).toBeDefined();
              expect(x.value?.documentRef).toStrictEqual(testDoc.documentRef);
              done();
            });
          })
        );

        it(
          'snapshotLoadingState$ should have a snapshot.',
          callbackTest((done) => {
            sub.subscription = store.snapshotLoadingState$
              .pipe(
                filter((x) => !isLoadingStateLoading(x)),
                first()
              )
              .subscribe((x) => {
                expect(isLoadingStateLoading(x)).toBe(false);
                expect(x.value).toBeDefined();
                expect(x.value?.id).toBe(testDoc.id);
                done();
              });
          })
        );

        describe('document does not exists', () => {
          beforeEach(async () => {
            await testDoc.accessor.delete();
          });

          it(
            'should not exist',
            callbackTest((done) => {
              sub.subscription = store.exists$.pipe(first()).subscribe((exists) => {
                expect(exists).toBe(false);
                done();
              });
            })
          );

          it(
            'dataLoadingState$ should return an error state.',
            callbackTest((done) => {
              sub.subscription = store.dataLoadingState$
                .pipe(
                  filter((x) => !isLoadingStateLoading(x)),
                  first()
                )
                .subscribe({
                  next: (state) => {
                    expect(state.error).toBeDefined();
                    done();
                  }
                });
            })
          );
        });

        describe('document exists', () => {
          const testValue = true;

          beforeEach(async () => {
            await testDoc.accessor.set({ test: testValue });
          });

          it(
            'should exist',
            callbackTest((done) => {
              sub.subscription = store.exists$.pipe(first()).subscribe((exists) => {
                expect(exists).toBe(true);
                done();
              });
            })
          );

          it(
            'dataLoadingState$ should return a success state',
            callbackTest((done) => {
              sub.subscription = store.dataLoadingState$
                .pipe(
                  filter((x) => !isLoadingStateLoading(x)),
                  first()
                )
                .subscribe({
                  next: (state) => {
                    expect(state.value).toBeDefined();
                    expect(state.value?.test).toBe(testValue);
                    done();
                  }
                });
            })
          );
        });
      });
    });
  });
});
