import {
  type MockItem,
  type MockItemSubItemDeep,
  type MockItemSubItemDeepDocument,
  mockItemSubItemDeepFirestoreCollection,
  type MockItemSubItemDeepFirestoreCollectionFactory,
  type MockItemSubItemDeepFirestoreCollectionGroup,
  mockItemSubItemDeepFirestoreCollectionGroup,
  type MockItemSubItemDeepRoles,
  type MockItemDocument,
  type MockItemFirestoreCollection,
  mockItemFirestoreCollection,
  type MockItemPrivate,
  type MockItemPrivateDocument,
  mockItemPrivateFirestoreCollection,
  type MockItemPrivateFirestoreCollectionFactory,
  type MockItemPrivateFirestoreCollectionGroup,
  mockItemPrivateFirestoreCollectionGroup,
  type MockItemPrivateRoles,
  type MockItemRoles,
  type MockItemSubItem,
  type MockItemSubItemDocument,
  mockItemSubItemFirestoreCollection,
  type MockItemSubItemFirestoreCollectionFactory,
  type MockItemSubItemFirestoreCollectionGroup,
  mockItemSubItemFirestoreCollectionGroup,
  type MockItemSubItemRoles,
  type MockItemTypes,
  type MockItemUser,
  type MockItemUserDocument,
  mockItemUserFirestoreCollection,
  type MockItemUserFirestoreCollectionFactory,
  mockItemUserFirestoreCollectionGroup,
  type MockItemUserFirestoreCollectionGroup,
  type MockItemUserRoles,
  mockItemSystemStateStoredDataConverterMap
} from './mock.item';
import { type FirebaseAppModelContext, type FirebasePermissionServiceModel, firebaseModelServiceFactory, firebaseModelsService, type FirestoreContext, type SystemStateFirestoreCollection, systemStateFirestoreCollection, grantFullAccessIfAdmin, type SystemState, type SystemStateDocument, type SystemStateRoles, type SystemStateTypes } from '@dereekb/firebase';
import { type GrantedRoleMap } from '@dereekb/model';
import { type PromiseOrValue } from '@dereekb/util';

// MARK: Collections
export abstract class MockItemCollections {
  abstract readonly mockItemCollection: MockItemFirestoreCollection;
  abstract readonly mockItemPrivateCollectionFactory: MockItemPrivateFirestoreCollectionFactory;
  abstract readonly mockItemPrivateCollectionGroup: MockItemPrivateFirestoreCollectionGroup;
  abstract readonly mockItemUserCollectionFactory: MockItemUserFirestoreCollectionFactory;
  abstract readonly mockItemUserCollectionGroup: MockItemUserFirestoreCollectionGroup;
  abstract readonly mockItemSubItemCollectionFactory: MockItemSubItemFirestoreCollectionFactory;
  abstract readonly mockItemSubItemCollectionGroup: MockItemSubItemFirestoreCollectionGroup;
  abstract readonly mockItemSubItemDeepCollectionFactory: MockItemSubItemDeepFirestoreCollectionFactory;
  abstract readonly mockItemSubItemDeepCollectionGroup: MockItemSubItemDeepFirestoreCollectionGroup;
  abstract readonly mockItemSystemStateCollection: SystemStateFirestoreCollection;
}

export function makeMockItemCollections(firestoreContext: FirestoreContext): MockItemCollections {
  return {
    mockItemCollection: mockItemFirestoreCollection(firestoreContext),
    mockItemPrivateCollectionFactory: mockItemPrivateFirestoreCollection(firestoreContext),
    mockItemPrivateCollectionGroup: mockItemPrivateFirestoreCollectionGroup(firestoreContext),
    mockItemUserCollectionFactory: mockItemUserFirestoreCollection(firestoreContext),
    mockItemUserCollectionGroup: mockItemUserFirestoreCollectionGroup(firestoreContext),
    mockItemSubItemCollectionFactory: mockItemSubItemFirestoreCollection(firestoreContext),
    mockItemSubItemCollectionGroup: mockItemSubItemFirestoreCollectionGroup(firestoreContext),
    mockItemSubItemDeepCollectionFactory: mockItemSubItemDeepFirestoreCollection(firestoreContext),
    mockItemSubItemDeepCollectionGroup: mockItemSubItemDeepFirestoreCollectionGroup(firestoreContext),
    mockItemSystemStateCollection: systemStateFirestoreCollection(firestoreContext, mockItemSystemStateStoredDataConverterMap)
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

export const mockItemUserFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemUser, MockItemUserDocument, MockItemUserRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemUser, MockItemUserDocument>, context: MockFirebaseContext, model: MockItemUserDocument): PromiseOrValue<GrantedRoleMap<MockItemUserRoles>> {
    const isOwnerUser = context.auth?.uid === model.documentRef.id;
    const roles: GrantedRoleMap<MockItemUserRoles> = context.rolesToReturn ?? { read: isOwnerUser };

    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemUserCollectionGroup
});

export const mockItemSubItemFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemSubItem, MockItemSubItemDocument, MockItemSubItemRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemSubItem, MockItemSubItemDocument>, context: MockFirebaseContext, model: MockItemSubItemDocument): PromiseOrValue<GrantedRoleMap<MockItemSubItemRoles>> {
    const roles: GrantedRoleMap<MockItemSubItemRoles> = context.rolesToReturn ?? { read: true };
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemSubItemCollectionGroup
});

export const mockItemSubItemDeepFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemSubItemDeep, MockItemSubItemDeepDocument, MockItemSubItemDeepRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemSubItemDeep, MockItemSubItemDeepDocument>, context: MockFirebaseContext, model: MockItemSubItemDeepDocument): PromiseOrValue<GrantedRoleMap<MockItemSubItemDeepRoles>> {
    const roles: GrantedRoleMap<MockItemSubItemDeepRoles> = context.rolesToReturn ?? { read: true };
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemSubItemDeepCollectionGroup
});

export const mockItemSystemStateFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, SystemState, SystemStateDocument, SystemStateRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<SystemState, SystemStateDocument>, context: MockFirebaseContext, model: SystemStateDocument): PromiseOrValue<GrantedRoleMap<SystemStateRoles>> {
    return grantFullAccessIfAdmin(context); // only sys-admin allowed
  },
  getFirestoreCollection: (c) => c.app.mockItemSystemStateCollection
});

// MARK: Model Service
export type MockModelTypes = SystemStateTypes | MockItemTypes;

export type MockFirebaseContextAppContext = MockItemCollections;

export type MockFirebaseBaseContext = FirebaseAppModelContext<MockFirebaseContextAppContext> & {
  /**
   * Configured in the context and in mockItem role map functions to return this value if provided.
   */
  rolesToReturn?: GrantedRoleMap<any>;
};

export const MOCK_FIREBASE_MODEL_SERVICE_FACTORIES = {
  systemState: mockItemSystemStateFirebaseModelServiceFactory,
  mockItem: mockItemFirebaseModelServiceFactory,
  mockItemPrivate: mockItemPrivateFirebaseModelServiceFactory,
  mockItemUser: mockItemUserFirebaseModelServiceFactory,
  mockItemSub: mockItemSubItemFirebaseModelServiceFactory,
  mockItemSubItemDeep: mockItemSubItemDeepFirebaseModelServiceFactory
};

export const mockFirebaseModelServices = firebaseModelsService<typeof MOCK_FIREBASE_MODEL_SERVICE_FACTORIES, MockFirebaseContext, MockModelTypes>(MOCK_FIREBASE_MODEL_SERVICE_FACTORIES);

export type MockFirebaseContext = MockFirebaseBaseContext & { service?: typeof mockFirebaseModelServices };
