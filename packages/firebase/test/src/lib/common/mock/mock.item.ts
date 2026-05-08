import { type Maybe, bitwiseObjectDencoder, modelFieldConversions } from '@dereekb/util';
import {
  type CollectionReference,
  type FirestoreCollection,
  type FirestoreContext,
  AbstractFirestoreDocument,
  type SingleItemFirestoreCollection,
  type FirestoreCollectionWithParent,
  AbstractFirestoreDocumentWithParent,
  firestoreBoolean,
  type ExpectedFirestoreModelData,
  optionalFirestoreString,
  firestoreDate,
  optionalFirestoreNumber,
  snapshotConverterFunctions,
  type FirestoreModelData,
  type CollectionGroup,
  type FirestoreCollectionGroup,
  firestoreModelIdentity,
  type UserRelated,
  type UserRelatedById,
  firestoreString,
  copyUserRelatedDataAccessorFactoryFunction,
  firestoreUID,
  firestoreUniqueStringArray,
  optionalFirestoreArray,
  optionalFirestoreDate,
  firestoreSubObject,
  type SystemStateStoredData,
  type SystemStateStoredDataConverterMap,
  type SystemStateStoredDataFieldConverterConfig,
  firestoreBitwiseObjectMap,
  firestoreNumber,
  type PagedItemConverter,
  type PagedItemDistributionScheme,
  type PagedItemFirestoreCollection,
  type PagedItemPageData,
  defaultPagedItemPageDataConverter
} from '@dereekb/firebase';
import { type GrantedReadRole } from '@dereekb/model';

// MARK: Collection
/**
 * Union of all mock model identity types used in the test suite.
 *
 * Each member corresponds to one of the mock Firestore models defined in this file.
 * Useful for generic constraints that need to accept any mock model identity.
 */
export type MockItemTypes = typeof mockItemIdentity | typeof mockItemPrivateIdentity | typeof mockItemUserIdentity | typeof mockItemSubItemIdentity | typeof mockItemSubItemDeepIdentity | typeof mockItemPagedIdentity;

// MARK: Mock Item
/**
 * {@link firestoreModelIdentity} for the root-level mock item collection (`mockItem` / `mi`).
 */
export const mockItemIdentity = firestoreModelIdentity('mockItem', 'mi');

/**
 * Application-level data for the root mock Firestore model.
 *
 * This is the converted (in-memory) representation. For the raw database representation,
 * see {@link MockItemData}.
 */
export interface MockItem {
  value?: Maybe<string>;
  /**
   * Optional date value
   */
  date?: Maybe<Date>;
  /**
   * Optional number value
   */
  number?: Maybe<number>;
  /**
   * List of tags.
   */
  tags?: Maybe<string[]>;
  /**
   * The test value is alway present.
   */
  test: boolean;
}

/**
 * Possible granted roles for {@link MockItem}. Includes the standard read role plus an admin role.
 */
export type MockItemRoles = GrantedReadRole | 'admin';

/**
 * {@link AbstractFirestoreDocument} implementation for {@link MockItem}.
 *
 * Provides document-level access to a single MockItem in Firestore.
 */
export class MockItemDocument extends AbstractFirestoreDocument<MockItem, MockItemDocument, typeof mockItemIdentity> {
  get modelIdentity() {
    return mockItemIdentity;
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
    tags: optionalFirestoreArray(),
    date: optionalFirestoreDate(),
    number: optionalFirestoreNumber(),
    test: firestoreBoolean({ default: true })
  }
});

/**
 * Used to build a mockItemCollection from a firestore instance with a converter setup.
 *
 * @param context - The Firestore context to resolve the root collection against.
 * @returns A typed {@link CollectionReference} for the root MockItem collection.
 */
export function mockItemCollectionReference(context: FirestoreContext): CollectionReference<MockItem> {
  return context.collection(mockItemIdentity.collectionName);
}

/**
 * Typed {@link FirestoreCollection} for {@link MockItem} documents.
 */
export type MockItemFirestoreCollection = FirestoreCollection<MockItem, MockItemDocument>;

/**
 * Creates a {@link MockItemFirestoreCollection} bound to the given {@link FirestoreContext}.
 *
 * @example
 * ```ts
 * const collection = mockItemFirestoreCollection(firestoreContext);
 * const doc = collection.documentAccessor().newDocument();
 * ```
 *
 * @param firestoreContext - The Firestore context (test or production) used to resolve the underlying collection reference.
 * @returns A {@link MockItemFirestoreCollection} wired with the {@link mockItemConverter} and {@link mockItemIdentity}.
 */
export function mockItemFirestoreCollection(firestoreContext: FirestoreContext): MockItemFirestoreCollection {
  return firestoreContext.firestoreCollection({
    converter: mockItemConverter,
    modelIdentity: mockItemIdentity,
    collection: mockItemCollectionReference(firestoreContext),
    makeDocument: (a, d) => new MockItemDocument(a, d),
    firestoreContext
  });
}

// MARK: MockItemPrivate
/**
 * {@link firestoreModelIdentity} for the MockItemPrivate subcollection (`mockItemPrivate` / `mip`).
 *
 * This is a child identity of {@link mockItemIdentity}, meaning MockItemPrivate documents
 * live as subcollections under MockItem documents.
 */
export const mockItemPrivateIdentity = firestoreModelIdentity(mockItemIdentity, 'mockItemPrivate', 'mip');

/**
 * Bitwise-encoded settings object representing cardinal directions.
 *
 * Used in conjunction with {@link mockItemSettingsItemDencoder} to test
 * {@link firestoreBitwiseObjectMap} encoding/decoding in Firestore.
 */
export interface MockItemSettingsItem {
  north?: boolean;
  south?: boolean;
  east?: boolean;
  west?: boolean;
}

/**
 * Enum indices for {@link MockItemSettingsItem} cardinal directions, used by the bitwise dencoder.
 */
export enum MockItemSettingsItemEnum {
  NORTH = 0,
  SOUTH = 1,
  EAST = 2,
  WEST = 3
}

/**
 * Bitwise dencoder (encoder/decoder) for {@link MockItemSettingsItem}.
 *
 * Converts between a boolean-keyed object and a compact bitwise integer
 * representation for efficient Firestore storage.
 */
export const mockItemSettingsItemDencoder = bitwiseObjectDencoder<MockItemSettingsItem, MockItemSettingsItemEnum>({
  maxIndex: 4,
  toSetFunction: (x) => {
    const set = new Set<MockItemSettingsItemEnum>();

    if (x.north) {
      set.add(MockItemSettingsItemEnum.NORTH);
    }

    if (x.south) {
      set.add(MockItemSettingsItemEnum.SOUTH);
    }

    if (x.east) {
      set.add(MockItemSettingsItemEnum.EAST);
    }

    if (x.west) {
      set.add(MockItemSettingsItemEnum.WEST);
    }

    return set;
  },
  fromSetFunction: (x) => {
    const object: MockItemSettingsItem = {};

    if (x.has(MockItemSettingsItemEnum.NORTH)) {
      object.north = true;
    }

    if (x.has(MockItemSettingsItemEnum.SOUTH)) {
      object.south = true;
    }

    if (x.has(MockItemSettingsItemEnum.EAST)) {
      object.east = true;
    }

    if (x.has(MockItemSettingsItemEnum.WEST)) {
      object.west = true;
    }

    return object;
  }
});

/**
 * Map of string keys to {@link MockItemSettingsItem} values.
 *
 * Stored in Firestore using {@link firestoreBitwiseObjectMap}, where each entry
 * is encoded as a compact bitwise integer.
 */
export type MockItemSettingsMap = Record<string, MockItemSettingsItem>;

/**
 * Private data for each MockItem.
 *
 * There is only a single private data item per each MockItem.
 */
export interface MockItemPrivate {
  comments?: Maybe<string>;
  num: number;
  values: string[];
  settings: MockItemSettingsMap;
  createdAt: Date;
}

/**
 * Possible granted roles for {@link MockItemPrivate}.
 */
export type MockItemPrivateRoles = GrantedReadRole | 'admin';

/**
 * {@link AbstractFirestoreDocument} implementation for {@link MockItemPrivate}.
 */
export class MockItemPrivateDocument extends AbstractFirestoreDocument<MockItemPrivate, MockItemPrivateDocument, typeof mockItemPrivateIdentity> {
  get modelIdentity() {
    return mockItemPrivateIdentity;
  }
}

/**
 * Raw Firestore storage type for {@link MockItemPrivate}.
 */
export type MockItemPrivateData = FirestoreModelData<MockItemPrivate, {}>;

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemPrivateConverter = snapshotConverterFunctions({
  fieldConversions: modelFieldConversions<MockItemPrivate, MockItemPrivateData>({
    num: firestoreNumber({ default: 0, defaultBeforeSave: 0 }),
    comments: optionalFirestoreString(),
    values: firestoreUniqueStringArray(),
    settings: firestoreBitwiseObjectMap({
      dencoder: mockItemSettingsItemDencoder
    }),
    createdAt: firestoreDate({ saveDefaultAsNow: true })
  })
});

/**
 * Creates a factory that produces {@link CollectionReference} instances for {@link MockItemPrivate}
 * subcollections under a given {@link MockItemDocument} parent.
 *
 * @param context - The Firestore context used to resolve subcollections.
 * @returns A function that, given a parent {@link MockItemDocument}, returns a typed {@link CollectionReference} for that parent's MockItemPrivate subcollection.
 */
export function mockItemPrivateCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemDocument) => CollectionReference<MockItemPrivate> {
  return (parent: MockItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemPrivateIdentity.collectionName);
  };
}

/**
 * Typed {@link SingleItemFirestoreCollection} for {@link MockItemPrivate}, constrained to one document per parent.
 */
export type MockItemPrivateFirestoreCollection = SingleItemFirestoreCollection<MockItemPrivate, MockItem, MockItemPrivateDocument>;

/**
 * Factory function type that creates a {@link MockItemPrivateFirestoreCollection} for a given parent.
 */
export type MockItemPrivateFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemPrivateFirestoreCollection;

/**
 * Creates a factory for producing {@link MockItemPrivateFirestoreCollection} instances bound to a parent {@link MockItemDocument}.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying subcollection.
 * @returns A factory that, given a parent {@link MockItemDocument}, returns a single-item collection wired with {@link mockItemPrivateConverter}.
 */
export function mockItemPrivateFirestoreCollection(firestoreContext: FirestoreContext): MockItemPrivateFirestoreCollectionFactory {
  const factory = mockItemPrivateCollectionReferenceFactory(firestoreContext);

  return (parent: MockItemDocument) => {
    return firestoreContext.singleItemFirestoreCollection({
      modelIdentity: mockItemPrivateIdentity,
      converter: mockItemPrivateConverter,
      collection: factory(parent),
      makeDocument: (a, d) => new MockItemPrivateDocument(a, d),
      firestoreContext,
      parent
    });
  };
}

/**
 * Creates a {@link CollectionGroup} reference for querying all {@link MockItemPrivate} documents across parents.
 *
 * @param context - The Firestore context used to resolve the collection group.
 * @returns A typed {@link CollectionGroup} reference for the MockItemPrivate collection name.
 */
export function mockItemPrivateCollectionReference(context: FirestoreContext): CollectionGroup<MockItemPrivate> {
  return context.collectionGroup(mockItemPrivateIdentity.collectionName);
}

/**
 * Typed {@link FirestoreCollectionGroup} for querying {@link MockItemPrivate} across all parent documents.
 */
export type MockItemPrivateFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemPrivate, MockItemPrivateDocument>;

/**
 * Creates a {@link MockItemPrivateFirestoreCollectionGroup} for cross-parent queries on {@link MockItemPrivate}.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying collection group reference.
 * @returns A typed {@link MockItemPrivateFirestoreCollectionGroup} wired with the {@link mockItemPrivateConverter}.
 */
export function mockItemPrivateFirestoreCollectionGroup(firestoreContext: FirestoreContext): MockItemPrivateFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: mockItemPrivateIdentity,
    converter: mockItemPrivateConverter,
    queryLike: mockItemPrivateCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new MockItemPrivateDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: MockItemUser
/**
 * {@link firestoreModelIdentity} for the MockItemUser subcollection (`mockItemUser` / `miu`).
 *
 * Child of {@link mockItemIdentity}. Represents per-user data associated with a {@link MockItem}.
 */
export const mockItemUserIdentity = firestoreModelIdentity(mockItemIdentity, 'mockItemUser', 'miu');

/**
 * An item associated per user to this item.
 */
export interface MockItemUser extends UserRelated, UserRelatedById {
  name: string;
}

/**
 * Possible granted roles for {@link MockItemUser}.
 */
export type MockItemUserRoles = GrantedReadRole | 'admin';

/**
 * {@link AbstractFirestoreDocument} implementation for {@link MockItemUser}.
 */
export class MockItemUserDocument extends AbstractFirestoreDocument<MockItemUser, MockItemUserDocument, typeof mockItemUserIdentity> {
  get modelIdentity() {
    return mockItemUserIdentity;
  }
}

/**
 * Raw Firestore storage type for {@link MockItemUser}.
 */
export type MockItemUserData = FirestoreModelData<MockItemUser, {}>;

/**
 * Firestore collection path name.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- camelCase chosen to match neighboring mock exports in this test fixture
export const mockItemUserCollectionName = 'mockItemUser';
/**
 * Default document identifier used for MockItemUser in tests.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- camelCase chosen to match neighboring mock exports in this test fixture
export const mockItemUserIdentifier = '0';

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemUserConverter = snapshotConverterFunctions({
  fieldConversions: modelFieldConversions<MockItemUser, MockItemUserData>({
    uid: firestoreUID(),
    name: firestoreString()
  })
});

/**
 * Creates a factory that produces {@link CollectionReference} instances for {@link MockItemUser}
 * subcollections under a given {@link MockItemDocument} parent.
 *
 * @param context - The Firestore context used to resolve subcollections.
 * @returns A function that, given a parent {@link MockItemDocument}, returns a typed {@link CollectionReference} for that parent's MockItemUser subcollection.
 */
export function mockItemUserCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemDocument) => CollectionReference<MockItemUser> {
  return (parent: MockItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemUserCollectionName);
  };
}

/**
 * Accessor factory for {@link MockItemUser} that copies user-related fields (uid) when creating documents.
 */
export const mockItemUserAccessorFactory = copyUserRelatedDataAccessorFactoryFunction<MockItemUser>();

/**
 * Typed {@link FirestoreCollectionWithParent} for {@link MockItemUser} documents under a {@link MockItem}.
 */
export type MockItemUserFirestoreCollection = FirestoreCollectionWithParent<MockItemUser, MockItem, MockItemUserDocument>;

/**
 * Factory function type that creates a {@link MockItemUserFirestoreCollection} for a given parent.
 */
export type MockItemUserFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemUserFirestoreCollection;

/**
 * Creates a factory for producing {@link MockItemUserFirestoreCollection} instances bound to a parent {@link MockItemDocument}.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying subcollection.
 * @returns A factory that, given a parent {@link MockItemDocument}, returns a per-parent collection wired with {@link mockItemUserConverter} and {@link mockItemUserAccessorFactory}.
 */
export function mockItemUserFirestoreCollection(firestoreContext: FirestoreContext): MockItemUserFirestoreCollectionFactory {
  const factory = mockItemUserCollectionReferenceFactory(firestoreContext);

  return (parent: MockItemDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      modelIdentity: mockItemUserIdentity,
      converter: mockItemUserConverter,
      collection: factory(parent),
      accessorFactory: mockItemUserAccessorFactory,
      makeDocument: (a, d) => new MockItemUserDocument(a, d),
      firestoreContext,
      parent
    });
  };
}

/**
 * Creates a {@link CollectionGroup} reference for querying all {@link MockItemUser} documents across parents.
 *
 * @param context - The Firestore context used to resolve the collection group.
 * @returns A typed {@link CollectionGroup} reference for the MockItemUser collection name.
 */
export function mockItemUserCollectionReference(context: FirestoreContext): CollectionGroup<MockItemUser> {
  return context.collectionGroup(mockItemUserCollectionName);
}

/**
 * Typed {@link FirestoreCollectionGroup} for querying {@link MockItemUser} across all parent documents.
 */
export type MockItemUserFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemUser, MockItemUserDocument>;

/**
 * Creates a {@link MockItemUserFirestoreCollectionGroup} for cross-parent queries on {@link MockItemUser}.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying collection group reference.
 * @returns A typed {@link MockItemUserFirestoreCollectionGroup} wired with the {@link mockItemUserConverter} and {@link mockItemUserAccessorFactory}.
 */
export function mockItemUserFirestoreCollectionGroup(firestoreContext: FirestoreContext): MockItemUserFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: mockItemUserIdentity,
    converter: mockItemUserConverter,
    queryLike: mockItemUserCollectionReference(firestoreContext),
    accessorFactory: mockItemUserAccessorFactory,
    makeDocument: (accessor, documentAccessor) => new MockItemUserDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: MockItemSubItem
/**
 * {@link firestoreModelIdentity} for the MockItemSubItem subcollection (`mockItemSub` / `misi`).
 *
 * Child of {@link mockItemIdentity}. Unlike {@link MockItemPrivate} (single item) or {@link MockItemUser} (per-user),
 * there can be an unlimited number of sub-items per parent MockItem.
 */
export const mockItemSubItemIdentity = firestoreModelIdentity(mockItemIdentity, 'mockItemSub', 'misi');

/**
 * Data for a sub item in our firestore collection.
 *
 * There may be an unlimited number of MockItemSubItems for a MockItem.
 */
export interface MockItemSubItem {
  value?: Maybe<number>;
}

/**
 * Possible granted roles for {@link MockItemSubItem}.
 */
export type MockItemSubItemRoles = GrantedReadRole | 'admin';

/**
 * {@link AbstractFirestoreDocumentWithParent} implementation for {@link MockItemSubItem}.
 *
 * Maintains a reference to its parent {@link MockItem} document.
 */
export class MockItemSubItemDocument extends AbstractFirestoreDocumentWithParent<MockItem, MockItemSubItem, MockItemSubItemDocument, typeof mockItemSubItemIdentity> {
  get modelIdentity() {
    return mockItemSubItemIdentity;
  }
}

/**
 * Raw Firestore storage type for {@link MockItemSubItem}. All fields match the application type exactly.
 */
export type MockItemSubItemData = ExpectedFirestoreModelData<MockItemSubItem>;

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemSubItemConverter = snapshotConverterFunctions<MockItemSubItem, MockItemSubItemData>({
  fields: {
    value: optionalFirestoreNumber()
  }
});

/**
 * Creates a factory that produces {@link CollectionReference} instances for {@link MockItemSubItem}
 * subcollections under a given {@link MockItemDocument} parent.
 *
 * @param context - The Firestore context used to resolve subcollections.
 * @returns A function that, given a parent {@link MockItemDocument}, returns a typed {@link CollectionReference} for that parent's MockItemSubItem subcollection.
 */
export function mockItemSubItemCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemDocument) => CollectionReference<MockItemSubItem> {
  return (parent: MockItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemSubItemIdentity.collectionName);
  };
}

/**
 * Typed {@link FirestoreCollectionWithParent} for {@link MockItemSubItem} documents under a {@link MockItem}.
 */
export type MockItemSubItemFirestoreCollection = FirestoreCollectionWithParent<MockItemSubItem, MockItem, MockItemSubItemDocument, MockItemDocument>;

/**
 * Factory function type that creates a {@link MockItemSubItemFirestoreCollection} for a given parent.
 */
export type MockItemSubItemFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemSubItemFirestoreCollection;

/**
 * Creates a factory for producing {@link MockItemSubItemFirestoreCollection} instances bound to a parent {@link MockItemDocument}.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying subcollection.
 * @returns A factory that, given a parent {@link MockItemDocument}, returns a per-parent collection wired with {@link mockItemSubItemConverter}.
 */
export function mockItemSubItemFirestoreCollection(firestoreContext: FirestoreContext): MockItemSubItemFirestoreCollectionFactory {
  const factory = mockItemSubItemCollectionReferenceFactory(firestoreContext);

  return (parent: MockItemDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      modelIdentity: mockItemSubItemIdentity,
      converter: mockItemSubItemConverter,
      collection: factory(parent),
      makeDocument: (a, d) => new MockItemSubItemDocument(a, d),
      firestoreContext,
      parent
    });
  };
}

/**
 * Creates a {@link CollectionGroup} reference for querying all {@link MockItemSubItem} documents across parents.
 *
 * @param context - The Firestore context used to resolve the collection group.
 * @returns A typed {@link CollectionGroup} reference for the MockItemSubItem collection name.
 */
export function mockItemSubItemCollectionReference(context: FirestoreContext): CollectionGroup<MockItemSubItem> {
  return context.collectionGroup(mockItemSubItemIdentity.collectionName);
}

/**
 * Typed {@link FirestoreCollectionGroup} for querying {@link MockItemSubItem} across all parent documents.
 */
export type MockItemSubItemFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemSubItem, MockItemSubItemDocument>;

/**
 * Creates a {@link MockItemSubItemFirestoreCollectionGroup} for cross-parent queries on {@link MockItemSubItem}.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying collection group reference.
 * @returns A typed {@link MockItemSubItemFirestoreCollectionGroup} wired with the {@link mockItemSubItemConverter}.
 */
export function mockItemSubItemFirestoreCollectionGroup(firestoreContext: FirestoreContext): MockItemSubItemFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: mockItemSubItemIdentity,
    converter: mockItemSubItemConverter,
    queryLike: mockItemSubItemCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new MockItemSubItemDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Sub-Sub Item
/**
 * {@link firestoreModelIdentity} for the MockItemSubItemDeep subcollection (`mockItemSubItemDeep` / `misid`).
 *
 * Child of {@link mockItemSubItemIdentity}, making this a three-level-deep nested collection
 * (MockItem -> MockItemSubItem -> MockItemSubItemDeep). Useful for testing deeply nested document access patterns.
 */
export const mockItemSubItemDeepIdentity = firestoreModelIdentity(mockItemSubItemIdentity, 'mockItemSubItemDeep', 'misid');

/**
 * Data for a sub item in our firestore collection.
 *
 * There may be an unlimited number of MockItemSubItemDeeps for a MockSubItem.
 */
export interface MockItemSubItemDeep {
  value?: Maybe<number>;
}

/**
 * Possible granted roles for {@link MockItemSubItemDeep}.
 */
export type MockItemSubItemDeepRoles = GrantedReadRole | 'admin';

/**
 * {@link AbstractFirestoreDocumentWithParent} implementation for {@link MockItemSubItemDeep}.
 *
 * Maintains a reference to its parent {@link MockItemSubItem} document.
 */
export class MockItemSubItemDeepDocument extends AbstractFirestoreDocumentWithParent<MockItemSubItem, MockItemSubItemDeep, MockItemSubItemDeepDocument, typeof mockItemSubItemDeepIdentity> {
  get modelIdentity() {
    return mockItemSubItemDeepIdentity;
  }
}

/**
 * Raw Firestore storage type for {@link MockItemSubItemDeep}. All fields match the application type exactly.
 */
export type MockItemSubItemDeepData = ExpectedFirestoreModelData<MockItemSubItemDeep>;

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemSubItemDeepConverter = snapshotConverterFunctions<MockItemSubItemDeep, MockItemSubItemDeepData>({
  fields: {
    value: optionalFirestoreNumber()
  }
});

/**
 * Creates a factory that produces {@link CollectionReference} instances for {@link MockItemSubItemDeep}
 * subcollections under a given {@link MockItemSubItemDocument} parent.
 *
 * @param context - The Firestore context used to resolve subcollections.
 * @returns A function that, given a parent {@link MockItemSubItemDocument}, returns a typed {@link CollectionReference} for that parent's MockItemSubItemDeep subcollection.
 */
export function mockItemSubItemDeepCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemSubItemDocument) => CollectionReference<MockItemSubItemDeep> {
  return (parent: MockItemSubItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemSubItemDeepIdentity.collectionName);
  };
}

/**
 * Typed {@link FirestoreCollectionWithParent} for {@link MockItemSubItemDeep} documents under a {@link MockItemSubItem}.
 */
export type MockItemSubItemDeepFirestoreCollection = FirestoreCollectionWithParent<MockItemSubItemDeep, MockItemSubItem, MockItemSubItemDeepDocument, MockItemSubItemDocument>;

/**
 * Factory function type that creates a {@link MockItemSubItemDeepFirestoreCollection} for a given parent.
 */
export type MockItemSubItemDeepFirestoreCollectionFactory = (parent: MockItemSubItemDocument) => MockItemSubItemDeepFirestoreCollection;

/**
 * Creates a factory for producing {@link MockItemSubItemDeepFirestoreCollection} instances bound to a parent {@link MockItemSubItemDocument}.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying subcollection.
 * @returns A factory that, given a parent {@link MockItemSubItemDocument}, returns a per-parent collection wired with {@link mockItemSubItemDeepConverter}.
 */
export function mockItemSubItemDeepFirestoreCollection(firestoreContext: FirestoreContext): MockItemSubItemDeepFirestoreCollectionFactory {
  const factory = mockItemSubItemDeepCollectionReferenceFactory(firestoreContext);

  return (parent: MockItemSubItemDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      modelIdentity: mockItemSubItemDeepIdentity,
      converter: mockItemSubItemDeepConverter,
      collection: factory(parent),
      makeDocument: (a, d) => new MockItemSubItemDeepDocument(a, d),
      firestoreContext,
      parent
    });
  };
}

/**
 * Creates a {@link CollectionGroup} reference for querying all {@link MockItemSubItemDeep} documents across parents.
 *
 * @param context - The Firestore context used to resolve the collection group.
 * @returns A typed {@link CollectionGroup} reference for the MockItemSubItemDeep collection name.
 */
export function mockItemSubItemDeepCollectionReference(context: FirestoreContext): CollectionGroup<MockItemSubItemDeep> {
  return context.collectionGroup(mockItemSubItemDeepIdentity.collectionName);
}

/**
 * Typed {@link FirestoreCollectionGroup} for querying {@link MockItemSubItemDeep} across all parent documents.
 */
export type MockItemSubItemDeepFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemSubItemDeep, MockItemSubItemDeepDocument>;

/**
 * Creates a {@link MockItemSubItemDeepFirestoreCollectionGroup} for cross-parent queries on {@link MockItemSubItemDeep}.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying collection group reference.
 * @returns A typed {@link MockItemSubItemDeepFirestoreCollectionGroup} wired with the {@link mockItemSubItemDeepConverter}.
 */
export function mockItemSubItemDeepFirestoreCollectionGroup(firestoreContext: FirestoreContext): MockItemSubItemDeepFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: mockItemSubItemDeepIdentity,
    converter: mockItemSubItemDeepConverter,
    queryLike: mockItemSubItemDeepCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new MockItemSubItemDeepDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: MockItemPaged
/**
 * {@link firestoreModelIdentity} for the MockItemPaged subcollection (`mockItemPaged` / `mip2`).
 *
 * Child of {@link mockItemIdentity}. Stores a logical {@link MockItemPagedEntry} array distributed
 * across multiple page documents, plus an index document that summarizes the layout. See
 * {@link PagedItemFirestoreCollection} for the underlying mechanism.
 */
export const mockItemPagedIdentity = firestoreModelIdentity(mockItemIdentity, 'mockItemPaged', 'mip2');

/**
 * Single entry stored inside a paged subcollection page.
 *
 * Items are grouped by {@link group} when using static distribution and treated as opaque
 * payloads when using dynamic (count-based) paging.
 */
export interface MockItemPagedEntry {
  readonly id: string;
  readonly group: string;
  readonly value: number;
}

/**
 * Possible granted roles for {@link MockItemPagedEntry} pages.
 */
export type MockItemPagedRoles = GrantedReadRole | 'admin';

/**
 * Page-document model shape for {@link MockItemPagedEntry}. The paged collection stores entries
 * inside this envelope (`i` = items, `c` = count). The standalone index document
 * (`{@link DEFAULT_PAGED_ITEM_INDEX_DOCUMENT_ID}`) lives in the same collection but uses a
 * different shape ({@link PagedItemIndexData}); from the model service's perspective only the
 * page envelope is the canonical document.
 */
export type MockItemPagedDocumentData = PagedItemPageData<MockItemPagedEntry>;

/**
 * {@link AbstractFirestoreDocumentWithParent} implementation for a single page document inside a
 * {@link MockItemPagedFirestoreCollection}. Used by the model service factory to address pages
 * the same way other subcollection documents are addressed.
 */
export class MockItemPagedDocument extends AbstractFirestoreDocumentWithParent<MockItem, MockItemPagedDocumentData, MockItemPagedDocument, typeof mockItemPagedIdentity> {
  get modelIdentity() {
    return mockItemPagedIdentity;
  }
}

/**
 * Per-item converter for {@link MockItemPagedEntry} used by the paged accessor.
 *
 * The mock entry shape is already Firestore-safe, so the converter is an identity
 * pass-through. Production usage may wrap a real converter (e.g. for date fields).
 */
export const mockItemPagedEntryConverter: PagedItemConverter<MockItemPagedEntry> = {
  fromData: (data) => data as MockItemPagedEntry,
  toData: (item) => item as unknown as object
};

/**
 * Static distribution scheme for {@link MockItemPagedEntry} that buckets items by their
 * {@link MockItemPagedEntry.group} field across three page IDs (`a`, `b`, `c`).
 */
export const mockItemPagedAlphaDistributionScheme: PagedItemDistributionScheme<MockItemPagedEntry> = {
  pageIds: ['a', 'b', 'c'],
  distribute: (entry) => entry.group
};

/**
 * Default `maxItemsPerPage` used by the dynamic mock paged collection factory. Kept small to
 * exercise multi-page boundary conditions in tests without writing many entries.
 */
export const MOCK_ITEM_PAGED_DEFAULT_MAX_ITEMS_PER_PAGE = 3;

/**
 * Typed {@link PagedItemFirestoreCollection} for {@link MockItemPagedEntry} items under a
 * {@link MockItem} parent.
 */
export type MockItemPagedFirestoreCollection = PagedItemFirestoreCollection<MockItemPagedEntry, MockItem, MockItemPagedDocument, MockItemDocument>;

/**
 * Factory function type that creates a {@link MockItemPagedFirestoreCollection} for a given parent.
 */
export type MockItemPagedFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemPagedFirestoreCollection;

/**
 * Configuration for {@link mockItemPagedFirestoreCollection}.
 */
export interface MockItemPagedFirestoreCollectionConfig {
  /**
   * When provided, the factory produces a statically-distributed paged collection using the
   * given scheme. When omitted, the factory produces a dynamic (count-based) paged collection
   * using {@link maxItemsPerPage}.
   */
  readonly distributionScheme?: PagedItemDistributionScheme<MockItemPagedEntry>;
  /**
   * Maximum items per page document in dynamic mode. Defaults to
   * {@link MOCK_ITEM_PAGED_DEFAULT_MAX_ITEMS_PER_PAGE}.
   */
  readonly maxItemsPerPage?: number;
}

/**
 * Creates a factory for producing {@link MockItemPagedFirestoreCollection} instances bound to a
 * parent {@link MockItemDocument}.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying subcollection.
 * @param config - Optional config selecting between dynamic (default) and static distribution.
 * @returns A factory that, given a parent {@link MockItemDocument}, returns a paged subcollection
 * wired with {@link mockItemPagedEntryConverter}.
 */
export function mockItemPagedFirestoreCollection(firestoreContext: FirestoreContext, config?: MockItemPagedFirestoreCollectionConfig): MockItemPagedFirestoreCollectionFactory {
  const { distributionScheme, maxItemsPerPage = MOCK_ITEM_PAGED_DEFAULT_MAX_ITEMS_PER_PAGE } = config ?? {};

  return (parent: MockItemDocument) => {
    return firestoreContext.pagedItemFirestoreCollection<MockItemPagedEntry, MockItem, MockItemPagedDocument, MockItemDocument>({
      modelIdentity: mockItemPagedIdentity,
      collection: firestoreContext.subcollection(parent.documentRef, mockItemPagedIdentity.collectionName),
      parent,
      makeDocument: (a, d) => new MockItemPagedDocument(a, d),
      firestoreContext,
      maxItemsPerPage,
      distributionScheme,
      itemConverter: mockItemPagedEntryConverter
    });
  };
}

/**
 * Creates a {@link CollectionGroup} reference for querying all {@link MockItemPagedDocumentData}
 * page documents across parents.
 *
 * Note: the index document (`_index`) lives in the same Firestore collection but has a different
 * shape ({@link PagedItemIndexData}); collection-group queries will surface both. Consumers
 * should filter by document id when only pages are desired.
 *
 * @param context - The Firestore context used to resolve the collection group.
 * @returns A typed {@link CollectionGroup} reference for the MockItemPaged collection name.
 */
export function mockItemPagedCollectionReference(context: FirestoreContext): CollectionGroup<MockItemPagedDocumentData> {
  return context.collectionGroup(mockItemPagedIdentity.collectionName);
}

/**
 * Typed {@link FirestoreCollectionGroup} for querying {@link MockItemPagedDocumentData} page
 * documents across all parents. Used by the model service factory to address paged page
 * documents in a parent-agnostic way.
 */
export type MockItemPagedFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemPagedDocumentData, MockItemPagedDocument>;

/**
 * Creates a {@link MockItemPagedFirestoreCollectionGroup} for cross-parent access to paged
 * page documents.
 *
 * @param firestoreContext - The Firestore context used to resolve the underlying collection group reference.
 * @returns A typed {@link MockItemPagedFirestoreCollectionGroup}.
 */
export function mockItemPagedFirestoreCollectionGroup(firestoreContext: FirestoreContext): MockItemPagedFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: mockItemPagedIdentity,
    converter: defaultPagedItemPageDataConverter<MockItemPagedEntry>(),
    queryLike: mockItemPagedCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new MockItemPagedDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Mock System Item
/**
 * System state type identifier for mock system state data.
 *
 * Used as the key in {@link mockItemSystemStateStoredDataConverterMap}.
 */
export const MOCK_SYSTEM_STATE_TYPE = 'mockitemsystemstate';

/**
 * Custom data stored within a mock system state document.
 *
 * Extends {@link SystemStateStoredData} with a `lat` (last-updated-at) timestamp field
 * to test sub-object field conversion in system state documents.
 */
export interface MockSystemData extends SystemStateStoredData {
  /**
   * Last updated at
   */
  lat: Date;
}

/**
 * Field converter config for {@link MockSystemData}, handling the `lat` date field conversion.
 */
export const mockItemSystemDataConverter: SystemStateStoredDataFieldConverterConfig<MockSystemData> = firestoreSubObject<MockSystemData>({
  objectField: {
    fields: {
      lat: firestoreDate({ saveDefaultAsNow: true })
    }
  }
});

/**
 * Maps system state type identifiers to their corresponding field converter configs.
 *
 * Used when creating the mock system state Firestore collection to register
 * the {@link MockSystemData} converter under the {@link MOCK_SYSTEM_STATE_TYPE} key.
 */
export const mockItemSystemStateStoredDataConverterMap: SystemStateStoredDataConverterMap = {
  [MOCK_SYSTEM_STATE_TYPE]: mockItemSystemDataConverter
};
