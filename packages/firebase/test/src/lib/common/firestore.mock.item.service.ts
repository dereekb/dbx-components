import {
  MockItem,
  MockItemDeepSubItem,
  MockItemDeepSubItemDocument,
  mockItemDeepSubItemFirestoreCollection,
  MockItemDeepSubItemFirestoreCollectionFactory,
  MockItemDeepSubItemFirestoreCollectionGroup,
  mockItemDeepSubItemFirestoreCollectionGroup,
  MockItemDeepSubItemRoles,
  MockItemDocument,
  MockItemFirestoreCollection,
  mockItemFirestoreCollection,
  MockItemPrivate,
  MockItemPrivateDocument,
  mockItemPrivateFirestoreCollection,
  MockItemPrivateFirestoreCollectionFactory,
  MockItemPrivateFirestoreCollectionGroup,
  mockItemPrivateFirestoreCollectionGroup,
  MockItemPrivateRoles,
  MockItemRoles,
  MockItemSubItem,
  MockItemSubItemDocument,
  mockItemSubItemFirestoreCollection,
  MockItemSubItemFirestoreCollectionFactory,
  MockItemSubItemFirestoreCollectionGroup,
  mockItemSubItemFirestoreCollectionGroup,
  MockItemSubItemRoles,
  MockItemTypes
} from './firestore.mock.item';
import { FirebaseAppModelContext, FirebasePermissionServiceModel, firebaseModelServiceFactory, firebaseModelsService, FirestoreContext } from '@dereekb/firebase';
import { GrantedRoleMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';

// MARK: Collections
export abstract class MockItemCollections {
  abstract readonly mockItemCollection: MockItemFirestoreCollection;
  abstract readonly mockItemPrivateCollectionFactory: MockItemPrivateFirestoreCollectionFactory;
  abstract readonly mockItemPrivateCollectionGroup: MockItemPrivateFirestoreCollectionGroup;
  abstract readonly mockItemSubItemCollectionFactory: MockItemSubItemFirestoreCollectionFactory;
  abstract readonly mockItemSubItemCollectionGroup: MockItemSubItemFirestoreCollectionGroup;
  abstract readonly mockItemDeepSubItemCollectionFactory: MockItemDeepSubItemFirestoreCollectionFactory;
  abstract readonly mockItemDeepSubItemCollectionGroup: MockItemDeepSubItemFirestoreCollectionGroup;
}

export function makeMockItemCollections(firestoreContext: FirestoreContext): MockItemCollections {
  return {
    mockItemCollection: mockItemFirestoreCollection(firestoreContext),
    mockItemPrivateCollectionFactory: mockItemPrivateFirestoreCollection(firestoreContext),
    mockItemPrivateCollectionGroup: mockItemPrivateFirestoreCollectionGroup(firestoreContext),
    mockItemSubItemCollectionFactory: mockItemSubItemFirestoreCollection(firestoreContext),
    mockItemSubItemCollectionGroup: mockItemSubItemFirestoreCollectionGroup(firestoreContext),
    mockItemDeepSubItemCollectionFactory: mockItemDeepSubItemFirestoreCollection(firestoreContext),
    mockItemDeepSubItemCollectionGroup: mockItemDeepSubItemFirestoreCollectionGroup(firestoreContext)
  };
}

// MARK: Models
export const mockItemFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItem, MockItemDocument, MockItemRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItem, MockItemDocument>, context: MockFirebaseContext, model: MockItemDocument): PromiseOrValue<GrantedRoleMap<MockItemRoles>> {
    const roles: GrantedRoleMap<MockItemRoles> = context.rolesToReturn ?? { read: true };

    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemCollection
});

export const mockItemPrivateFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemPrivate, MockItemPrivateDocument, MockItemPrivateRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemPrivate, MockItemPrivateDocument>, context: MockFirebaseContext, model: MockItemPrivateDocument): PromiseOrValue<GrantedRoleMap<MockItemPrivateRoles>> {
    const roles: GrantedRoleMap<MockItemPrivateRoles> = context.rolesToReturn ?? { read: true };
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemPrivateCollectionGroup
});

export const mockItemSubItemFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemSubItem, MockItemSubItemDocument, MockItemSubItemRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemSubItem, MockItemSubItemDocument>, context: MockFirebaseContext, model: MockItemSubItemDocument): PromiseOrValue<GrantedRoleMap<MockItemSubItemRoles>> {
    const roles: GrantedRoleMap<MockItemSubItemRoles> = context.rolesToReturn ?? { read: true };
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemSubItemCollectionGroup
});

export const mockItemDeepSubItemFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemDeepSubItem, MockItemDeepSubItemDocument, MockItemDeepSubItemRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemDeepSubItem, MockItemDeepSubItemDocument>, context: MockFirebaseContext, model: MockItemDeepSubItemDocument): PromiseOrValue<GrantedRoleMap<MockItemDeepSubItemRoles>> {
    const roles: GrantedRoleMap<MockItemDeepSubItemRoles> = context.rolesToReturn ?? { read: true };
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemDeepSubItemCollectionGroup
});

// MARK: Model Service
export type MockModelTypes = MockItemTypes;

export type MockFirebaseContextAppContext = MockItemCollections;

export type MockFirebaseBaseContext = FirebaseAppModelContext<MockFirebaseContextAppContext> & {
  /**
   * Configured in the context and in mockItem role map functions to return this value if provided.
   */
  rolesToReturn?: GrantedRoleMap<any>;
};

export const MOCK_FIREBASE_MODEL_SERVICE_FACTORIES = {
  mockItem: mockItemFirebaseModelServiceFactory,
  mockItemPrivate: mockItemPrivateFirebaseModelServiceFactory,
  mockItemSub: mockItemSubItemFirebaseModelServiceFactory,
  mockItemDeepSub: mockItemDeepSubItemFirebaseModelServiceFactory
};

export const mockFirebaseModelServices = firebaseModelsService<typeof MOCK_FIREBASE_MODEL_SERVICE_FACTORIES, MockFirebaseContext, MockModelTypes>(MOCK_FIREBASE_MODEL_SERVICE_FACTORIES);

export type MockFirebaseContext = MockFirebaseBaseContext & { service?: typeof mockFirebaseModelServices };
