import { MockItem, MockItemCollections, MockItemDeepSubItem, MockItemDeepSubItemDocument, MockItemDeepSubItemRoles, MockItemDocument, MockItemPrivate, MockItemPrivateDocument, MockItemPrivateRoles, MockItemRoles, MockItemSubItem, MockItemSubItemDocument, MockItemSubItemRoles, MockItemTypes } from './firestore.mock.item';
import { FirebaseAppModelContext, FirebasePermissionServiceModel, firebaseModelServiceFactory, firebaseModelsService } from '@dereekb/firebase';
import { fullAccessRolesMap, GrantedRoleMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';

// MARK: Models
export type MockItemFirebaseContext = FirebaseAppModelContext<MockItemCollections> & {
  /**
   * Configured in the context and in mockItem role map functions to return this value if provided.
   */
  rolesToReturn?: GrantedRoleMap<any>;
};

export const mockItemFirebaseModelServiceFactory = firebaseModelServiceFactory<MockItemFirebaseContext, MockItem, MockItemDocument, MockItemRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<MockItem, MockItemDocument>, context: MockItemFirebaseContext, model: MockItemDocument): PromiseOrValue<GrantedRoleMap<MockItemRoles>> {
    let roles: GrantedRoleMap<MockItemRoles> = context.rolesToReturn ?? fullAccessRolesMap();

    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemCollection
});

export const mockItemPrivateFirebaseModelServiceFactory = firebaseModelServiceFactory<MockItemFirebaseContext, MockItemPrivate, MockItemPrivateDocument, MockItemPrivateRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<MockItemPrivate, MockItemPrivateDocument>, context: MockItemFirebaseContext, model: MockItemPrivateDocument): PromiseOrValue<GrantedRoleMap<MockItemPrivateRoles>> {
    let roles: GrantedRoleMap<MockItemPrivateRoles> = context.rolesToReturn ?? fullAccessRolesMap();
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemPrivateCollectionGroup
});

export const mockItemSubItemFirebaseModelServiceFactory = firebaseModelServiceFactory<MockItemFirebaseContext, MockItemSubItem, MockItemSubItemDocument, MockItemSubItemRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<MockItemSubItem, MockItemSubItemDocument>, context: MockItemFirebaseContext, model: MockItemSubItemDocument): PromiseOrValue<GrantedRoleMap<MockItemSubItemRoles>> {
    let roles: GrantedRoleMap<MockItemSubItemRoles> = context.rolesToReturn ?? fullAccessRolesMap();
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemSubItemCollectionGroup
});

export const mockItemDeepSubItemFirebaseModelServiceFactory = firebaseModelServiceFactory<MockItemFirebaseContext, MockItemDeepSubItem, MockItemDeepSubItemDocument, MockItemDeepSubItemRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<MockItemDeepSubItem, MockItemDeepSubItemDocument>, context: MockItemFirebaseContext, model: MockItemDeepSubItemDocument): PromiseOrValue<GrantedRoleMap<MockItemDeepSubItemRoles>> {
    let roles: GrantedRoleMap<MockItemDeepSubItemRoles> = context.rolesToReturn ?? fullAccessRolesMap();
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemDeepSubItemCollectionGroup
});

// MARK: Model Service
export type MockModelTypes = MockItemTypes;

export type MockFirebaseContext = MockItemFirebaseContext;

export const MOCK_FIREBASE_MODEL_SERVICE_FACTORIES = {
  mockitem: mockItemFirebaseModelServiceFactory,
  mockitemprivate: mockItemPrivateFirebaseModelServiceFactory,
  mockitemsub: mockItemSubItemFirebaseModelServiceFactory,
  mockitemdeepsub: mockItemDeepSubItemFirebaseModelServiceFactory
};

export const mockFirebaseModelServices = firebaseModelsService<typeof MOCK_FIREBASE_MODEL_SERVICE_FACTORIES, MockFirebaseContext, MockModelTypes>(MOCK_FIREBASE_MODEL_SERVICE_FACTORIES);
