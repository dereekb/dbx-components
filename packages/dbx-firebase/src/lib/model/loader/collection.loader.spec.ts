/**
 * @jest-environment node
 */
// use the node environment, as the jsdom environment breaks for tests that use the firestore.

import { SubscriptionObject } from '@dereekb/rxjs';
import { authorizedTestWithMockItemCollection, MockItem, MockItemDocument } from '@dereekb/firebase/test';
import { first, map, of, timeout } from 'rxjs';
import { DbxFirebaseCollectionLoaderInstance, dbxFirebaseCollectionLoaderInstanceWithCollection } from './collection.loader.instance';

describe('DbxFirebaseCollectionLoaderInstance', () => {
  authorizedTestWithMockItemCollection((f) => {
    let instance: DbxFirebaseCollectionLoaderInstance<MockItem, MockItemDocument>;
    let sub: SubscriptionObject;

    beforeEach(() => {
      const firestoreCollection = f.instance.firestoreCollection;
      sub = new SubscriptionObject();
      instance = dbxFirebaseCollectionLoaderInstanceWithCollection(firestoreCollection);
    });

    afterEach(() => {
      sub.destroy();
      instance.destroy();
    });

    describe('accessors', () => {
      it('firestoreIteration$ should return the current iteration.', (done) => {
        sub.subscription = instance.firestoreIteration$.pipe(first()).subscribe((x) => {
          expect(x).toBeDefined();
          done();
        });
      });

      it('should return the current accumulator.', (done) => {
        sub.subscription = instance.accumulator$.pipe(first()).subscribe((x) => {
          expect(x).toBeDefined();
          done();
        });
      });
    });

    describe('no collection set', () => {
      beforeEach(() => {
        instance.setCollection(undefined);
      });

      it('firestoreIteration$ should not emit anything.', (done) => {
        sub.subscription = instance.firestoreIteration$
          .pipe(
            map(() => false),
            timeout({ first: 200, with: () => of(true) }),
            first()
          )
          .subscribe((x) => {
            expect(x).toBe(true);
            done();
          });
      });

      it('accumulator$ should not emit anything.', (done) => {
        sub.subscription = instance.accumulator$
          .pipe(
            map(() => false),
            timeout({ first: 200, with: () => of(true) }),
            first()
          )
          .subscribe((x) => {
            expect(x).toBe(true);
            done();
          });
      });
    });
  });
});
