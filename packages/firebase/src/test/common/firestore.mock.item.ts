import { Maybe } from '@dereekb/util';
import { makeSnapshotConverterFunctions, firestoreDate, firestoreBoolean, firestoreString, CollectionReference, FirestoreCollection, FirestoreContext, AbstractFirestoreDocument, firestoreNumber, SingleItemFirestoreCollection, FirestoreCollectionWithParent } from '../../lib/common';

// MARK: Mock Item
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
export const mockItemCollectionPath = 'test';

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemConverter = makeSnapshotConverterFunctions<MockItem>({
  fields: {
    test: firestoreBoolean({ default: false, defaultBeforeSave: false }),
    value: firestoreString()
  }
});

/**
 * Used to build a mockItemCollection from a firestore instance with a converter setup.
 * 
 * @param firestore 
 * @returns 
 */
export function mockItemCollectionReference(context: FirestoreContext): CollectionReference<MockItem> {
  return context.collection(mockItemCollectionPath).withConverter<MockItem>(mockItemConverter);
}

export type MockItemFirestoreCollection = FirestoreCollection<MockItem, MockItemDocument>;

export function mockItemFirestoreCollection(firestoreContext: FirestoreContext): MockItemFirestoreCollection {
  return firestoreContext.firestoreCollection({
    itemsPerPage: 50,
    collection: mockItemCollectionReference(firestoreContext),
    makeDocument: (a, d) => new MockItemDocument(a, d),
    firestoreContext
  });
}

// MARK: MockItemPrivateData
/**
 * Private data for each MockItem.
 * 
 * There is only a single private data item per each MockItem.
 */
export interface MockItemPrivateData {
  comments?: string;
  createdAt?: Date
}

/**
 * FirestoreDocument for MockItem
 */
export class MockItemPrivateDataDocument extends AbstractFirestoreDocument<MockItemPrivateData, MockItemPrivateDataDocument> { }

/**
 * Firestore collection path name.
 */
export const mockItemPrivateDataCollectionPath = 'private';
export const mockItemPrivateDataIdentifier = '0';

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemPrivateDataConverter = makeSnapshotConverterFunctions<MockItemPrivateData>({
  fields: {
    comments: firestoreString(),
    createdAt: firestoreDate({ saveDefaultAsNow: true })
  }
});

/**
 * Used to build a mockItemCollection from a firestore instance with a converter setup.
 * 
 * @param firestore 
 * @returns 
 */
export function mockItemPrivateDataCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemDocument) => CollectionReference<MockItemPrivateData> {
  return (parent: MockItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemPrivateDataCollectionPath).withConverter<MockItemPrivateData>(mockItemPrivateDataConverter);
  };
}

export type MockItemPrivateDataFirestoreCollection = SingleItemFirestoreCollection<MockItemPrivateData, MockItem, MockItemPrivateDataDocument>;
export type MockItemPrivateDataFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemPrivateDataFirestoreCollection;

export function mockItemPrivateDataFirestoreCollection(firestoreContext: FirestoreContext): MockItemPrivateDataFirestoreCollectionFactory {
  const factory = mockItemPrivateDataCollectionReferenceFactory(firestoreContext);

  return (parent: MockItemDocument) => {
    return firestoreContext.singleItemFirestoreCollection({
      itemsPerPage: 50,
      collection: factory(parent),
      makeDocument: (a, d) => new MockItemPrivateDataDocument(a, d),
      firestoreContext,
      parent,
      singleItemIdentifier: mockItemPrivateDataIdentifier
    });
  };
}

// MARK: MockItemSubItem
/**
 * Data for a sub item in our firestore collection.
 * 
 * There may be an unlimited number of MockItemSubItems for a MockItem.
 */
export interface MockItemSubItem {
  value?: Maybe<number>;
}

/**
 * FirestoreDocument for MockItem
 */
export class MockItemSubItemDocument extends AbstractFirestoreDocument<MockItemSubItem, MockItemSubItemDocument> { }

/**
 * Firestore collection path name.
 */
export const mockItemSubItemCollectionPath = 'sub';

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemSubItemConverter = makeSnapshotConverterFunctions<MockItemSubItem>({
  fields: {
    value: firestoreNumber()
  }
});

export function mockItemSubItemCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemDocument) => CollectionReference<MockItemSubItem> {
  return (parent: MockItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemSubItemCollectionPath).withConverter<MockItemSubItem>(mockItemSubItemConverter);
  };
}

export type MockItemSubItemFirestoreCollection = FirestoreCollectionWithParent<MockItemSubItem, MockItem, MockItemSubItemDocument, MockItemDocument>;
export type MockItemSubItemFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemSubItemFirestoreCollection;

export function mockItemSubItemFirestoreCollection(firestoreContext: FirestoreContext): MockItemSubItemFirestoreCollectionFactory {
  const factory = mockItemSubItemCollectionReferenceFactory(firestoreContext);

  return (parent: MockItemDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      itemsPerPage: 50,
      collection: factory(parent),
      makeDocument: (a, d) => new MockItemSubItemDocument(a, d),
      firestoreContext,
      parent
    });
  };
}

// MARK: Collection
export abstract class MockItemCollections {
  abstract readonly mockItem: MockItemFirestoreCollection;
  abstract readonly mockItemPrivateData: MockItemPrivateDataFirestoreCollectionFactory;
  abstract readonly mockItemSubItem: MockItemSubItemFirestoreCollectionFactory;
}

export function makeMockItemCollections(firestoreContext: FirestoreContext): MockItemCollections {
  return {
    mockItem: mockItemFirestoreCollection(firestoreContext),
    mockItemPrivateData: mockItemPrivateDataFirestoreCollection(firestoreContext),
    mockItemSubItem: mockItemSubItemFirestoreCollection(firestoreContext)
  };
}
