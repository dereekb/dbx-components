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
/**
 * Abstract class defining the shape of all mock item Firestore collections.
 *
 * Implementations provide concrete collection instances for each mock model type,
 * including root collections, subcollection factories, and collection groups.
 * Use {@link makeMockItemCollections} to create a concrete instance from a {@link FirestoreContext}.
 */
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

/**
 * Creates a concrete {@link MockItemCollections} instance with all collections bound to the given {@link FirestoreContext}.
 *
 * This is the primary way to instantiate the full set of mock collections for a test run.
 */
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
/**
 * Model service factory for {@link MockItem}. Returns configurable roles from `context.rolesToReturn`, defaulting to `{ read: true }`.
 */
export const mockItemFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItem, MockItemDocument, MockItemRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItem, MockItemDocument>, context: MockFirebaseContext, _model: MockItemDocument): PromiseOrValue<GrantedRoleMap<MockItemRoles>> {
    const roles: GrantedRoleMap<MockItemRoles> = context.rolesToReturn ?? { read: true };

    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemCollection
});

/**
 * Model service factory for {@link MockItemPrivate}. Returns configurable roles from `context.rolesToReturn`, defaulting to `{ read: true }`.
 */
export const mockItemPrivateFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemPrivate, MockItemPrivateDocument, MockItemPrivateRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemPrivate, MockItemPrivateDocument>, context: MockFirebaseContext, _model: MockItemPrivateDocument): PromiseOrValue<GrantedRoleMap<MockItemPrivateRoles>> {
    const roles: GrantedRoleMap<MockItemPrivateRoles> = context.rolesToReturn ?? { read: true };
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemPrivateCollectionGroup
});

/**
 * Model service factory for {@link MockItemUser}. Grants read access if the authenticated user owns the document;
 * otherwise uses `context.rolesToReturn`.
 */
export const mockItemUserFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemUser, MockItemUserDocument, MockItemUserRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemUser, MockItemUserDocument>, context: MockFirebaseContext, model: MockItemUserDocument): PromiseOrValue<GrantedRoleMap<MockItemUserRoles>> {
    const isOwnerUser = context.auth?.uid === model.documentRef.id;
    const roles: GrantedRoleMap<MockItemUserRoles> = context.rolesToReturn ?? { read: isOwnerUser };

    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemUserCollectionGroup
});

/**
 * Model service factory for {@link MockItemSubItem}. Returns configurable roles from `context.rolesToReturn`, defaulting to `{ read: true }`.
 */
export const mockItemSubItemFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemSubItem, MockItemSubItemDocument, MockItemSubItemRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemSubItem, MockItemSubItemDocument>, context: MockFirebaseContext, _model: MockItemSubItemDocument): PromiseOrValue<GrantedRoleMap<MockItemSubItemRoles>> {
    const roles: GrantedRoleMap<MockItemSubItemRoles> = context.rolesToReturn ?? { read: true };
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemSubItemCollectionGroup
});

/**
 * Model service factory for {@link MockItemSubItemDeep}. Returns configurable roles from `context.rolesToReturn`, defaulting to `{ read: true }`.
 */
export const mockItemSubItemDeepFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, MockItemSubItemDeep, MockItemSubItemDeepDocument, MockItemSubItemDeepRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<MockItemSubItemDeep, MockItemSubItemDeepDocument>, context: MockFirebaseContext, _model: MockItemSubItemDeepDocument): PromiseOrValue<GrantedRoleMap<MockItemSubItemDeepRoles>> {
    const roles: GrantedRoleMap<MockItemSubItemDeepRoles> = context.rolesToReturn ?? { read: true };
    return roles;
  },
  getFirestoreCollection: (c) => c.app.mockItemSubItemDeepCollectionGroup
});

/**
 * Model service factory for {@link SystemState}. Only grants access to system admins via {@link grantFullAccessIfAdmin}.
 */
export const mockItemSystemStateFirebaseModelServiceFactory = firebaseModelServiceFactory<MockFirebaseContext, SystemState, SystemStateDocument, SystemStateRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<SystemState, SystemStateDocument>, context: MockFirebaseContext, _model: SystemStateDocument): PromiseOrValue<GrantedRoleMap<SystemStateRoles>> {
    return grantFullAccessIfAdmin(context); // only sys-admin allowed
  },
  getFirestoreCollection: (c) => c.app.mockItemSystemStateCollection
});

// MARK: Model Service
/**
 * Union of all model identity types used in the mock Firebase service layer, including system state.
 */
export type MockModelTypes = SystemStateTypes | MockItemTypes;

/**
 * The application context type for mock Firebase models. Provides access to all mock collections.
 */
export type MockFirebaseContextAppContext = MockItemCollections;

/**
 * Base context for mock Firebase model operations.
 *
 * Combines the standard {@link FirebaseAppModelContext} (which provides `app` and `auth`)
 * with an optional `rolesToReturn` override used by mock role-map functions to return
 * predetermined roles in tests.
 */
export type MockFirebaseBaseContext = FirebaseAppModelContext<MockFirebaseContextAppContext> & {
  /**
   * Configured in the context and in mockItem role map functions to return this value if provided.
   */
  rolesToReturn?: GrantedRoleMap<any>;
};

/**
 * Registry of all mock model service factories, keyed by model name.
 *
 * Passed to {@link firebaseModelsService} to create the composite {@link mockFirebaseModelServices}.
 */
export const MOCK_FIREBASE_MODEL_SERVICE_FACTORIES = {
  systemState: mockItemSystemStateFirebaseModelServiceFactory,
  mockItem: mockItemFirebaseModelServiceFactory,
  mockItemPrivate: mockItemPrivateFirebaseModelServiceFactory,
  mockItemUser: mockItemUserFirebaseModelServiceFactory,
  mockItemSub: mockItemSubItemFirebaseModelServiceFactory,
  mockItemSubItemDeep: mockItemSubItemDeepFirebaseModelServiceFactory
};

/**
 * Composite model service built from {@link MOCK_FIREBASE_MODEL_SERVICE_FACTORIES}.
 *
 * Provides permission checking and collection access for all mock models in a unified API.
 */
export const mockFirebaseModelServices = firebaseModelsService<typeof MOCK_FIREBASE_MODEL_SERVICE_FACTORIES, MockFirebaseContext, MockModelTypes>(MOCK_FIREBASE_MODEL_SERVICE_FACTORIES);

/**
 * Full mock Firebase context type used throughout the test suite.
 *
 * Extends {@link MockFirebaseBaseContext} with an optional reference to the composite
 * {@link mockFirebaseModelServices} instance.
 */
export type MockFirebaseContext = MockFirebaseBaseContext & { service?: typeof mockFirebaseModelServices };
