import { Maybe, modelFieldConversions } from '@dereekb/util';
import { CollectionReference, FirestoreCollection, FirestoreContext, AbstractFirestoreDocument, SingleItemFirestoreCollection, FirestoreCollectionWithParent, AbstractFirestoreDocumentWithParent, firestoreString, firestoreBoolean, ExpectedFirestoreModelData, optionalFirestoreString, firestoreDate, optionalFirestoreNumber, snapshotConverterFunctions, FirestoreModelData, CollectionGroup, FirestoreCollectionGroup } from '@dereekb/firebase';
import { GrantedReadRole } from '@dereekb/model';

// MARK: Collection
export type MockItemTypes = typeof mockItemCollectionName | typeof mockItemPrivateCollectionName | typeof mockItemSubItemCollectionName | typeof mockItemDeepSubItemCollectionName;

// MARK: Mock Item
/**
 * Firestore collection path name.
 */
export const mockItemCollectionName = 'mockitem';

/**
 * Converted data for a test item in our firestore collection.
 */
export interface MockItem {
  value?: Maybe<string>;

  /**
   * The test value is alway present.
   */
  test: boolean;
}

export type MockItemRoles = GrantedReadRole | 'admin';

export class MockItemDocument extends AbstractFirestoreDocument<MockItem, MockItemDocument> {
  get modelType() {
    return mockItemCollectionName;
  }
}

/**
 * MockItem as it is stored into the database.
 *
 * Test is optional.
 */
export type MockItemData = FirestoreModelData<
  MockItem,
  {
    /**
     * The test value may not be defined in the database.
     */
    test?: Maybe<boolean>;
  }
>;

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemConverter = snapshotConverterFunctions<MockItem, MockItemData>({
  fields: {
    value: optionalFirestoreString(),
    test: firestoreBoolean({ default: true })
  }
});

/**
 * Used to build a mockItemCollection from a firestore instance with a converter setup.
 *
 * @param firestore
 * @returns
 */
export function mockItemCollectionReference(context: FirestoreContext): CollectionReference<MockItem> {
  return context.collection(mockItemCollectionName).withConverter<MockItem>(mockItemConverter);
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

// MARK: MockItemPrivate
/**
 * Private data for each MockItem.
 *
 * There is only a single private data item per each MockItem.
 */
export interface MockItemPrivate {
  comments?: Maybe<string>;
  createdAt: Date;
}

export type MockItemPrivateRoles = GrantedReadRole | 'admin';

/**
 * FirestoreDocument for MockItem
 */
export class MockItemPrivateDocument extends AbstractFirestoreDocument<MockItemPrivate, MockItemPrivateDocument> {
  get modelType() {
    return mockItemPrivateCollectionName;
  }
}

export type MockItemPrivateData = FirestoreModelData<MockItemPrivate, {}>;

/**
 * Firestore collection path name.
 */
export const mockItemPrivateCollectionName = 'mockitemprivate';
export const mockItemPrivateIdentifier = '0';

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemPrivateConverter = snapshotConverterFunctions({
  fieldConversions: modelFieldConversions<MockItemPrivate, MockItemPrivateData>({
    comments: optionalFirestoreString(),
    createdAt: firestoreDate({ saveDefaultAsNow: true })
  })
});

/**
 * Used to build a mockItemCollection from a firestore instance with a converter setup.
 *
 * @param firestore
 * @returns
 */
export function mockItemPrivateCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemDocument) => CollectionReference<MockItemPrivate> {
  return (parent: MockItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemPrivateCollectionName).withConverter<MockItemPrivate>(mockItemPrivateConverter);
  };
}

export type MockItemPrivateFirestoreCollection = SingleItemFirestoreCollection<MockItemPrivate, MockItem, MockItemPrivateDocument>;
export type MockItemPrivateFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemPrivateFirestoreCollection;

export function mockItemPrivateFirestoreCollection(firestoreContext: FirestoreContext): MockItemPrivateFirestoreCollectionFactory {
  const factory = mockItemPrivateCollectionReferenceFactory(firestoreContext);

  return (parent: MockItemDocument) => {
    return firestoreContext.singleItemFirestoreCollection({
      itemsPerPage: 50,
      collection: factory(parent),
      makeDocument: (a, d) => new MockItemPrivateDocument(a, d),
      firestoreContext,
      parent,
      singleItemIdentifier: mockItemPrivateIdentifier
    });
  };
}

export function mockItemPrivateCollectionReference(context: FirestoreContext): CollectionGroup<MockItemPrivate> {
  return context.collectionGroup(mockItemPrivateCollectionName).withConverter<MockItemPrivate>(mockItemPrivateConverter);
}

export type MockItemPrivateFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemPrivate, MockItemPrivateDocument>;

export function mockItemPrivateFirestoreCollectionGroup(firestoreContext: FirestoreContext): MockItemPrivateFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    itemsPerPage: 50,
    queryLike: mockItemPrivateCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new MockItemPrivateDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: MockItemSubItem
/**
 * Firestore collection path name.
 */
export const mockItemSubItemCollectionName = 'mockitemsub';

/**
 * Data for a sub item in our firestore collection.
 *
 * There may be an unlimited number of MockItemSubItems for a MockItem.
 */
export interface MockItemSubItem {
  value?: Maybe<number>;
}

export type MockItemSubItemRoles = GrantedReadRole | 'admin';

/**
 * FirestoreDocument for MockItem
 */
export class MockItemSubItemDocument extends AbstractFirestoreDocumentWithParent<MockItem, MockItemSubItem, MockItemSubItemDocument> {
  get modelType() {
    return mockItemSubItemCollectionName;
  }
}

export type MockItemSubItemData = ExpectedFirestoreModelData<MockItemSubItem>;

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemSubItemConverter = snapshotConverterFunctions<MockItemSubItem, MockItemSubItemData>({
  fields: {
    value: optionalFirestoreNumber()
  }
});

export function mockItemSubItemCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemDocument) => CollectionReference<MockItemSubItem> {
  return (parent: MockItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemSubItemCollectionName).withConverter<MockItemSubItem>(mockItemSubItemConverter);
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

export function mockItemSubItemCollectionReference(context: FirestoreContext): CollectionGroup<MockItemSubItem> {
  return context.collectionGroup(mockItemSubItemCollectionName).withConverter<MockItemSubItem>(mockItemSubItemConverter);
}

export type MockItemSubItemFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemSubItem, MockItemSubItemDocument>;

export function mockItemSubItemFirestoreCollectionGroup(firestoreContext: FirestoreContext): MockItemSubItemFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    itemsPerPage: 50,
    queryLike: mockItemSubItemCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new MockItemSubItemDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Sub-Sub Item
/**
 * Firestore collection path name.
 */
export const mockItemDeepSubItemCollectionName = 'mockitemdeepsub';

/**
 * Data for a sub item in our firestore collection.
 *
 * There may be an unlimited number of MockItemDeepSubItems for a MockSubItem.
 */
export interface MockItemDeepSubItem {
  value?: Maybe<number>;
}

export type MockItemDeepSubItemRoles = GrantedReadRole | 'admin';

/**
 * FirestoreDocument for MockSubItem
 */
export class MockItemDeepSubItemDocument extends AbstractFirestoreDocumentWithParent<MockItemSubItem, MockItemDeepSubItem, MockItemDeepSubItemDocument> {
  get modelType() {
    return mockItemDeepSubItemCollectionName;
  }
}

export type MockItemDeepSubItemData = ExpectedFirestoreModelData<MockItemDeepSubItem>;

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemDeepSubItemConverter = snapshotConverterFunctions<MockItemDeepSubItem, MockItemDeepSubItemData>({
  fields: {
    value: optionalFirestoreNumber()
  }
});

export function mockItemDeepSubItemCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemSubItemDocument) => CollectionReference<MockItemDeepSubItem> {
  return (parent: MockItemSubItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemDeepSubItemCollectionName).withConverter<MockItemDeepSubItem>(mockItemDeepSubItemConverter);
  };
}

export type MockItemDeepSubItemFirestoreCollection = FirestoreCollectionWithParent<MockItemDeepSubItem, MockItemSubItem, MockItemDeepSubItemDocument, MockItemSubItemDocument>;
export type MockItemDeepSubItemFirestoreCollectionFactory = (parent: MockItemSubItemDocument) => MockItemDeepSubItemFirestoreCollection;

export function mockItemDeepSubItemFirestoreCollection(firestoreContext: FirestoreContext): MockItemDeepSubItemFirestoreCollectionFactory {
  const factory = mockItemDeepSubItemCollectionReferenceFactory(firestoreContext);

  return (parent: MockItemSubItemDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      itemsPerPage: 50,
      collection: factory(parent),
      makeDocument: (a, d) => new MockItemDeepSubItemDocument(a, d),
      firestoreContext,
      parent
    });
  };
}

export function mockItemDeepSubItemCollectionReference(context: FirestoreContext): CollectionGroup<MockItemDeepSubItem> {
  return context.collectionGroup(mockItemDeepSubItemCollectionName).withConverter<MockItemDeepSubItem>(mockItemDeepSubItemConverter);
}

export type MockItemDeepSubItemFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemDeepSubItem, MockItemDeepSubItemDocument>;

export function mockItemDeepSubItemFirestoreCollectionGroup(firestoreContext: FirestoreContext): MockItemDeepSubItemFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    itemsPerPage: 50,
    queryLike: mockItemDeepSubItemCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new MockItemDeepSubItemDocument(accessor, documentAccessor),
    firestoreContext
  });
}
