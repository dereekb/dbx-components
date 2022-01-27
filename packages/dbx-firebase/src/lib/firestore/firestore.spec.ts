import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

import { Firestore } from '@firebase/firestore';
import { collection, CollectionReference, DocumentReference } from '@firebase/firestore';
import { FirestoreDocument } from './document';
import { FirestoreCollection, makeFirestoreCollection } from './firestore';

/**
 * Data for a test item in our firestore collection.
 */
export interface TestItem {

}

export class TestItemDocument implements FirestoreDocument<TestItem> {

  constructor(readonly documentRef: DocumentReference<TestItem>) { }

}

export const testItemCollectionPath = 'test';

export function testItemCollection(firestore: Firestore): CollectionReference<TestItem> {
  return collection(firestore, testItemCollectionPath);
}

describe('FirestoreCollection', () => {

  let testEnv: RulesTestEnvironment;
  let firestore: Firestore;
  let firestoreCollection: FirestoreCollection<TestItem, TestItemDocument>;

  beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
      // projectId: "demo-project-1234",
      firestore: {
        // rules: fs.readFileSync("firestore.rules", "utf8"),
      },
    });

    firestore = testEnv.authenticatedContext('test').firestore() as any as Firestore;
  });

  afterEach(() => {
    testEnv.clearFirestore();
  });

  describe('makeFirestoreCollection()', () => {

    it('should create a new collection.', () => {

      firestoreCollection = makeFirestoreCollection({
        itemsPerPage: 50,
        collection: testItemCollection(firestore),
        makeDocument: (x) => new TestItemDocument(x.documentRef)
      });

      expect(firestoreCollection).toBeDefined();
    });

  });

});
