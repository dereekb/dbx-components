import { Maybe } from '@dereekb/util';
import { makeSnapshotConverterFunctions, firestoreBoolean, firestoreString, CollectionReference, FirestoreCollection, FirestoreContext, AbstractFirestoreDocument } from '../../lib/common';

// MARK: Test Item
/**
 * Data for a test item in our firestore collection.
 */
export interface MockItem {
  test?: boolean;
  value?: Maybe<string>;
}

/**
 * FirestoreDocument for MockItem
 */
export class MockItemDocument extends AbstractFirestoreDocument<MockItem, MockItemDocument> { }

/**
 * Firestore collection path name.
 */
export const testItemCollectionPath = 'test';

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const testItemConverter = makeSnapshotConverterFunctions<MockItem>({
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
export function testItemCollectionReference(context: FirestoreContext): CollectionReference<MockItem> {
  return context.collection(testItemCollectionPath).withConverter<MockItem>(testItemConverter);
}

export type MockItemFirestoreCollection = FirestoreCollection<MockItem, MockItemDocument>;

export function testItemFirestoreCollection(context: FirestoreContext): MockItemFirestoreCollection {
  return context.firestoreCollection({
    itemsPerPage: 50,
    collection: testItemCollectionReference(context),
    makeDocument: (a, d) => new MockItemDocument(a, d)
  });
}
