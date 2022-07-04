import {
  MockItem,
  MockItemSubItemDeep,
  MockItemSubItemDeepDocument,
  mockItemSubItemDeepFirestoreCollection,
  MockItemSubItemDeepFirestoreCollectionFactory,
  MockItemSubItemDeepFirestoreCollectionGroup,
  mockItemSubItemDeepFirestoreCollectionGroup,
  MockItemSubItemDeepRoles,
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
  MockItemTypes,
  MockItemUser,
  MockItemUserDocument,
  mockItemUserFirestoreCollection,
  MockItemUserFirestoreCollectionFactory,
  mockItemUserFirestoreCollectionGroup,
  MockItemUserFirestoreCollectionGroup,
  MockItemUserRoles
} from './mock.item';
import { FirebaseAppModelContext, FirebasePermissionServiceModel, firebaseModelServiceFactory, firebaseModelsService, FirestoreContext } from '@dereekb/firebase';
import { GrantedRoleMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';

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
    mockItemSubItemDeepCollectionGroup: mockItemSubItemDeepFirestoreCollectionGroup(firestoreContext)
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
  mockItemUser: mockItemUserFirebaseModelServiceFactory,
  mockItemSub: mockItemSubItemFirebaseModelServiceFactory,
  mockItemSubItemDeep: mockItemSubItemDeepFirebaseModelServiceFactory
};

export const mockFirebaseModelServices = firebaseModelsService<typeof MOCK_FIREBASE_MODEL_SERVICE_FACTORIES, MockFirebaseContext, MockModelTypes>(MOCK_FIREBASE_MODEL_SERVICE_FACTORIES);

export type MockFirebaseContext = MockFirebaseBaseContext & { service?: typeof mockFirebaseModelServices };
