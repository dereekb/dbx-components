/**
 * @jest-environment node
 */
// use the node environment, as the jsdom environment breaks for tests that use the firestore.

import { authorizedTestWithMockItemCollection, MockItem, MockItemDocument } from "@dereekb/firebase";
import { first } from "rxjs";
import { DbxFirebaseCollectionLoaderInstance, dbxFirebaseCollectionLoaderInstanceWithCollection } from "./collection.loader.instance";

describe('DbxFirebaseCollectionLoaderInstance', () => {

  authorizedTestWithMockItemCollection((f) => {

    let instance: DbxFirebaseCollectionLoaderInstance<MockItem, MockItemDocument>;

    beforeEach(() => {
      const firestoreCollection = f.instance.firestoreCollection;
      instance = dbxFirebaseCollectionLoaderInstanceWithCollection(firestoreCollection);
    });

    afterEach(() => {
      instance.destroy();
    });

    describe('accessors', () => {

      it('firestoreIteration$ should return the current iteration.', (done) => {

        instance.firestoreIteration$.pipe(first()).subscribe((x) => {
          expect(x).toBeDefined();
          done();
        });

      });

      it('should return the current accumulator.', (done) => {

        instance.accumulator$.pipe(first()).subscribe((x) => {
          expect(x).toBeDefined();
          done();
        });

      });

    });

  });

});
