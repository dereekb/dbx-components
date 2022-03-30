import { Maybe } from '@dereekb/util';
import { makeSnapshotConverterFunctions, firestoreBoolean, firestoreString, CollectionReference, FirestoreCollection, FirestoreContext, AbstractFirestoreDocument } from '../lib/common';

// MARK: Test Item
/**
 * Data for a test item in our firestore collection.
 */
export interface TestItem {
  test?: boolean;
  value?: Maybe<string>;
}

/**
 * FirestoreDocument for TestItem
 */
export class TestItemDocument extends AbstractFirestoreDocument<TestItem, TestItemDocument> { }

/**
 * Firestore collection path name.
 */
export const testItemCollectionPath = 'test';

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const testItemConverter = makeSnapshotConverterFunctions<TestItem>({
  fields: {
    test: firestoreBoolean({ default: false, defaultBeforeSave: false }),
    value: firestoreString()
  }
});

/**
 * Used to build a testItemCollection from a firestore instance with a converter setup.
 * 
 * @param firestore 
 * @returns 
 */
export function testItemCollectionReference(context: FirestoreContext): CollectionReference<TestItem> {
  return context.collection(testItemCollectionPath).withConverter<TestItem>(testItemConverter);
}

export type TestItemFirestoreCollection = FirestoreCollection<TestItem, TestItemDocument>;

export function testItemFirestoreCollection(context: FirestoreContext): TestItemFirestoreCollection {
  return context.firestoreCollection({
    itemsPerPage: 50,
    collection: testItemCollectionReference(context.firestore),
    makeDocument: (a, d) => new TestItemDocument(a, d)
  });
}
