import { Maybe } from '@dereekb/util';
import { Firestore, collection, CollectionReference } from 'firebase/firestore';
import { AbstractFirestoreDocument } from '../lib/firestore/document';
import { FirestoreCollection, makeFirestoreCollection } from '../lib/firestore/firestore';
import { makeSnapshotConverterFunctions } from '../lib/firestore/snapshot';
import { firestoreBoolean, firestoreString } from '../lib/firestore/snapshot.field';

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
export function testItemCollectionReference(firestore: Firestore): CollectionReference<TestItem> {
  return collection(firestore, testItemCollectionPath).withConverter<TestItem>(testItemConverter);
}

export type TestItemFirestoreCollection = FirestoreCollection<TestItem, TestItemDocument>;

export function testItemFirestoreCollection(firestore: Firestore): TestItemFirestoreCollection {
  return makeFirestoreCollection({
    itemsPerPage: 50,
    collection: testItemCollectionReference(firestore),
    makeDocument: (a, d) => new TestItemDocument(a, d)
  });
}
