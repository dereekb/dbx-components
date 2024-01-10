import { Maybe, bitwiseObjectDencoder, modelFieldConversions } from '@dereekb/util';
import {
  CollectionReference,
  FirestoreCollection,
  FirestoreContext,
  AbstractFirestoreDocument,
  SingleItemFirestoreCollection,
  FirestoreCollectionWithParent,
  AbstractFirestoreDocumentWithParent,
  firestoreBoolean,
  ExpectedFirestoreModelData,
  optionalFirestoreString,
  firestoreDate,
  optionalFirestoreNumber,
  snapshotConverterFunctions,
  FirestoreModelData,
  CollectionGroup,
  FirestoreCollectionGroup,
  firestoreModelIdentity,
  UserRelated,
  UserRelatedById,
  firestoreString,
  copyUserRelatedDataAccessorFactoryFunction,
  firestoreUID,
  firestoreUniqueStringArray,
  optionalFirestoreArray,
  optionalFirestoreDate,
  firestoreSubObject,
  SystemStateStoredData,
  SystemStateStoredDataConverterMap,
  SystemStateStoredDataFieldConverterConfig,
  firestoreBitwiseObjectMap
} from '@dereekb/firebase';
import { GrantedReadRole } from '@dereekb/model';

// MARK: Collection
export type MockItemTypes = typeof mockItemIdentity | typeof mockItemPrivateIdentity | typeof mockItemUserIdentity | typeof mockItemSubItemIdentity | typeof mockItemSubItemDeepIdentity;

// MARK: Mock Item
export const mockItemIdentity = firestoreModelIdentity('mockItem', 'mi');

/**
 * Converted data for a test item in our firestore collection.
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

export type MockItemRoles = GrantedReadRole | 'admin';

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
 * @param firestore
 * @returns
 */
export function mockItemCollectionReference(context: FirestoreContext): CollectionReference<MockItem> {
  return context.collection(mockItemIdentity.collectionName);
}

export type MockItemFirestoreCollection = FirestoreCollection<MockItem, MockItemDocument>;

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
export const mockItemPrivateIdentity = firestoreModelIdentity(mockItemIdentity, 'mockItemPrivate', 'mip');

export interface MockItemSettingsItem {
  north?: boolean;
  south?: boolean;
  east?: boolean;
  west?: boolean;
}

export enum MockItemSettingsItemEnum {
  NORTH = 0,
  SOUTH = 1,
  EAST = 2,
  WEST = 3
}

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

export type MockItemSettingsMap = Record<string, MockItemSettingsItem>;

/**
 * Private data for each MockItem.
 *
 * There is only a single private data item per each MockItem.
 */
export interface MockItemPrivate {
  comments?: Maybe<string>;
  values: string[];
  settings: MockItemSettingsMap;
  createdAt: Date;
}

export type MockItemPrivateRoles = GrantedReadRole | 'admin';

/**
 * FirestoreDocument for MockItem
 */
export class MockItemPrivateDocument extends AbstractFirestoreDocument<MockItemPrivate, MockItemPrivateDocument, typeof mockItemPrivateIdentity> {
  get modelIdentity() {
    return mockItemPrivateIdentity;
  }
}

export type MockItemPrivateData = FirestoreModelData<MockItemPrivate, {}>;

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemPrivateConverter = snapshotConverterFunctions({
  fieldConversions: modelFieldConversions<MockItemPrivate, MockItemPrivateData>({
    comments: optionalFirestoreString(),
    values: firestoreUniqueStringArray(),
    settings: firestoreBitwiseObjectMap({
      dencoder: mockItemSettingsItemDencoder
    }),
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
    return context.subcollection(parent.documentRef, mockItemPrivateIdentity.collectionName);
  };
}

export type MockItemPrivateFirestoreCollection = SingleItemFirestoreCollection<MockItemPrivate, MockItem, MockItemPrivateDocument>;
export type MockItemPrivateFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemPrivateFirestoreCollection;

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

export function mockItemPrivateCollectionReference(context: FirestoreContext): CollectionGroup<MockItemPrivate> {
  return context.collectionGroup(mockItemPrivateIdentity.collectionName);
}

export type MockItemPrivateFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemPrivate, MockItemPrivateDocument>;

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
export const mockItemUserIdentity = firestoreModelIdentity(mockItemIdentity, 'mockItemUser', 'miu');

/**
 * An item associated per user to this item.
 */
export interface MockItemUser extends UserRelated, UserRelatedById {
  name: string;
}

export type MockItemUserRoles = GrantedReadRole | 'admin';

/**
 * FirestoreDocument for MockItem
 */
export class MockItemUserDocument extends AbstractFirestoreDocument<MockItemUser, MockItemUserDocument, typeof mockItemUserIdentity> {
  get modelIdentity() {
    return mockItemUserIdentity;
  }
}

export type MockItemUserData = FirestoreModelData<MockItemUser, {}>;

/**
 * Firestore collection path name.
 */
export const mockItemUserCollectionName = 'mockItemUser';
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
 * Used to build a mockItemCollection from a firestore instance with a converter setup.
 *
 * @param firestore
 * @returns
 */
export function mockItemUserCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemDocument) => CollectionReference<MockItemUser> {
  return (parent: MockItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemUserCollectionName);
  };
}

export const mockItemUserAccessorFactory = copyUserRelatedDataAccessorFactoryFunction<MockItemUser>();

export type MockItemUserFirestoreCollection = FirestoreCollectionWithParent<MockItemUser, MockItem, MockItemUserDocument>;
export type MockItemUserFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemUserFirestoreCollection;

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

export function mockItemUserCollectionReference(context: FirestoreContext): CollectionGroup<MockItemUser> {
  return context.collectionGroup(mockItemUserCollectionName);
}

export type MockItemUserFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemUser, MockItemUserDocument>;

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
export const mockItemSubItemIdentity = firestoreModelIdentity(mockItemIdentity, 'mockItemSub', 'misi');

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
export class MockItemSubItemDocument extends AbstractFirestoreDocumentWithParent<MockItem, MockItemSubItem, MockItemSubItemDocument, typeof mockItemSubItemIdentity> {
  get modelIdentity() {
    return mockItemSubItemIdentity;
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
    return context.subcollection(parent.documentRef, mockItemSubItemIdentity.collectionName);
  };
}

export type MockItemSubItemFirestoreCollection = FirestoreCollectionWithParent<MockItemSubItem, MockItem, MockItemSubItemDocument, MockItemDocument>;
export type MockItemSubItemFirestoreCollectionFactory = (parent: MockItemDocument) => MockItemSubItemFirestoreCollection;

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

export function mockItemSubItemCollectionReference(context: FirestoreContext): CollectionGroup<MockItemSubItem> {
  return context.collectionGroup(mockItemSubItemIdentity.collectionName);
}

export type MockItemSubItemFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemSubItem, MockItemSubItemDocument>;

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
export const mockItemSubItemDeepIdentity = firestoreModelIdentity(mockItemSubItemIdentity, 'mockItemSubItemDeep', 'misid');

/**
 * Data for a sub item in our firestore collection.
 *
 * There may be an unlimited number of MockItemSubItemDeeps for a MockSubItem.
 */
export interface MockItemSubItemDeep {
  value?: Maybe<number>;
}

export type MockItemSubItemDeepRoles = GrantedReadRole | 'admin';

/**
 * FirestoreDocument for MockSubItem
 */
export class MockItemSubItemDeepDocument extends AbstractFirestoreDocumentWithParent<MockItemSubItem, MockItemSubItemDeep, MockItemSubItemDeepDocument, typeof mockItemSubItemDeepIdentity> {
  get modelIdentity() {
    return mockItemSubItemDeepIdentity;
  }
}

export type MockItemSubItemDeepData = ExpectedFirestoreModelData<MockItemSubItemDeep>;

/**
 * Used to build a FirestoreDataConverter. Fields are configured via configuration. See the SnapshotConverterFunctions for more info.
 */
export const mockItemSubItemDeepConverter = snapshotConverterFunctions<MockItemSubItemDeep, MockItemSubItemDeepData>({
  fields: {
    value: optionalFirestoreNumber()
  }
});

export function mockItemSubItemDeepCollectionReferenceFactory(context: FirestoreContext): (parent: MockItemSubItemDocument) => CollectionReference<MockItemSubItemDeep> {
  return (parent: MockItemSubItemDocument) => {
    return context.subcollection(parent.documentRef, mockItemSubItemDeepIdentity.collectionName);
  };
}

export type MockItemSubItemDeepFirestoreCollection = FirestoreCollectionWithParent<MockItemSubItemDeep, MockItemSubItem, MockItemSubItemDeepDocument, MockItemSubItemDocument>;
export type MockItemSubItemDeepFirestoreCollectionFactory = (parent: MockItemSubItemDocument) => MockItemSubItemDeepFirestoreCollection;

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

export function mockItemSubItemDeepCollectionReference(context: FirestoreContext): CollectionGroup<MockItemSubItemDeep> {
  return context.collectionGroup(mockItemSubItemDeepIdentity.collectionName);
}

export type MockItemSubItemDeepFirestoreCollectionGroup = FirestoreCollectionGroup<MockItemSubItemDeep, MockItemSubItemDeepDocument>;

export function mockItemSubItemDeepFirestoreCollectionGroup(firestoreContext: FirestoreContext): MockItemSubItemDeepFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: mockItemSubItemDeepIdentity,
    converter: mockItemSubItemDeepConverter,
    queryLike: mockItemSubItemDeepCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new MockItemSubItemDeepDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Mock System Item
export const MOCK_SYSTEM_STATE_TYPE = 'mockitemsystemstate';

export interface MockSystemData extends SystemStateStoredData {
  /**
   * Last updated at
   */
  lat: Date;
}

export const mockItemSystemDataConverter: SystemStateStoredDataFieldConverterConfig<MockSystemData> = firestoreSubObject<MockSystemData>({
  objectField: {
    fields: {
      lat: firestoreDate({ saveDefaultAsNow: true })
    }
  }
});

export const mockItemSystemStateStoredDataConverterMap: SystemStateStoredDataConverterMap = {
  [MOCK_SYSTEM_STATE_TYPE]: mockItemSystemDataConverter
};
