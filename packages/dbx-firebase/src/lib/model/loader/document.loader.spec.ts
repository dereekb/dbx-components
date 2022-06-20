/**
 * @jest-environment node
 */
// use the node environment, as the jsdom environment breaks for tests that use the firestore.

import { loadingStateHasFinishedLoading, loadingStateIsLoading, SubscriptionObject } from '@dereekb/rxjs';
import { authorizedTestWithMockItemCollection, MockItem, MockItemDocument } from '@dereekb/firebase/test';
import { filter, first } from 'rxjs';
import { DbxFirebaseDocumentLoaderInstance, dbxFirebaseDocumentLoaderInstanceWithAccessor } from './document.loader.instance';
import { makeDocuments } from '@dereekb/firebase';

describe('DbxFirebaseDocumentLoaderInstance', () => {
  authorizedTestWithMockItemCollection((f) => {
    let instance: DbxFirebaseDocumentLoaderInstance<MockItem, MockItemDocument>;
    let sub: SubscriptionObject;

    beforeEach(() => {
      const firestoreCollection = f.instance.firestoreCollection;
      sub = new SubscriptionObject();
      instance = dbxFirebaseDocumentLoaderInstanceWithAccessor(firestoreCollection.documentAccessor());
    });

    afterEach(() => {
      sub.destroy();
      instance.destroy();
    });

    describe('accessors', () => {
      let items: MockItemDocument[];

      beforeEach(async () => {
        items = await makeDocuments(f.instance.firestoreCollection.documentAccessor(), {
          count: 5,
          init: (i) => {
            return {
              value: `${i}`,
              test: true,
              string: ''
            };
          }
        });

        instance.setDocuments(items);
      });

      it('data$ should return the current iteration.', (done) => {
        sub.subscription = instance.data$.pipe(first()).subscribe((x) => {
          expect(x).toBeDefined();
          expect(x.length).toBe(items.length);
          done();
        });
      });

      it('pageLoadingState$ should return the current state.', (done) => {
        sub.subscription = instance.pageLoadingState$
          .pipe(
            filter((x) => loadingStateHasFinishedLoading(x)),
            first()
          )
          .subscribe((x) => {
            expect(x).toBeDefined();
            expect(x.value?.length).toBe(items.length);
            done();
          });
      });
    });
  });
});
