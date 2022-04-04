import { first, from } from "rxjs";
import { limit, orderBy, startAfter, startAt, where, limitToLast } from "../../lib";
import { makeDocuments } from "../../lib/common/firestore/accessor/document.utility";
import { FirestoreCollectionQueryFactoryFunction } from "../../lib/common/firestore/query/query";
import { MockItemDocument, MockItem } from "./firestore.mock.item";
import { MockItemCollectionFixture } from "./firestore.mock.item.fixture";

/**
 * Describes accessor driver tests, using a MockItemCollectionFixture.
 * 
 * @param f 
 */
export function describeFirestoreIterationTests(f: MockItemCollectionFixture) {

  describe('firestoreItemPageIteration', () => {

    it('todo', () => {

      // TODO!

      expect(true).toBe(true);


    })

  });

}
