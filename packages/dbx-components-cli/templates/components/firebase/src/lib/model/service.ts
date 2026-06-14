import {
  type FirebaseAppModelContext,
  firebaseModelServiceFactory,
  firebaseModelsService,
  type FirebasePermissionServiceModel,
  type FirestoreContext,
  grantFullAccessIfAdmin,
  grantFullAccessIfAuthUserRelated,
  grantModelRolesIfAdmin,
  grantModelRolesIfAuthUserRelatedModelFunction,
  type NotificationBox,
  type NotificationBoxDocument,
  notificationBoxFirestoreCollection,
  type NotificationBoxFirestoreCollection,
  type NotificationBoxRoles,
  type Notification,
  type NotificationDocument,
  notificationFirestoreCollectionFactory,
  type NotificationFirestoreCollectionFactory,
  notificationFirestoreCollectionGroup,
  type NotificationFirestoreCollectionGroup,
  type NotificationFirestoreCollections,
  type NotificationRoles,
  type NotificationUser,
  type NotificationUserDocument,
  notificationUserFirestoreCollection,
  type NotificationUserFirestoreCollection,
  type NotificationUserRoles,
  type NotificationWeek,
  type NotificationWeekDocument,
  notificationWeekFirestoreCollectionFactory,
  type NotificationWeekFirestoreCollectionFactory,
  notificationWeekFirestoreCollectionGroup,
  type NotificationWeekFirestoreCollectionGroup,
  type NotificationWeekRoles,
  type NotificationLoggedEventDay,
  type NotificationLoggedEventDayDocument,
  notificationLoggedEventDayFirestoreCollectionFactory,
  type NotificationLoggedEventDayFirestoreCollectionFactory,
  notificationLoggedEventDayFirestoreCollectionGroup,
  type NotificationLoggedEventDayFirestoreCollectionGroup,
  type NotificationLoggedEventDayRoles,
  notificationLoggedEventDayPagedItemsCollectionFactory,
  type NotificationLoggedEventDayPagedItemsFirestoreCollectionFactory,
  type NotificationLoggedEventDayPageDocument,
  type NotificationLoggedEventDayPageDocumentData,
  notificationLoggedEventDayPageFirestoreCollectionGroup,
  type NotificationLoggedEventDayPageFirestoreCollectionGroup,
  type SystemState,
  type SystemStateDocument,
  systemStateFirestoreCollection,
  type SystemStateFirestoreCollection,
  type SystemStateFirestoreCollections,
  type SystemStateRoles,
  type SystemStateTypes,
  type FirestoreContextReference,
  type NotificationSummaryFirestoreCollection,
  notificationSummaryFirestoreCollection,
  type NotificationSummary,
  type NotificationSummaryDocument,
  type NotificationSummaryRoles,
  type NotificationTypes,
  type StorageFileFirestoreCollections,
  type StorageFileFirestoreCollection,
  storageFileFirestoreCollection,
  type StorageFile,
  type StorageFileDocument,
  type StorageFileRoles,
  type StorageFileTypes,
  type StorageFileGroup,
  type StorageFileGroupDocument,
  type StorageFileGroupRoles,
  storageFileGroupFirestoreCollection,
  type StorageFileGroupFirestoreCollection
} from '@dereekb/firebase';
import { noAccessRoleMap, fullAccessRoleMap, grantedRoleKeysMapFromArray, type GrantedRoleMap } from '@dereekb/model';
import { type PromiseOrValue } from '@dereekb/util';
import { type Example, type ExampleDocument, type ExampleRoles, type ExampleTypes, exampleFirestoreCollection, type ExampleFirestoreCollection, type ExampleFirestoreCollections } from './example';
import { type ProfileTypes, type Profile, type ProfileDocument, type ProfileFirestoreCollection, type ProfilePrivateData, type ProfilePrivateDataDocument, type ProfilePrivateDataFirestoreCollectionFactory, type ProfilePrivateDataFirestoreCollectionGroup, type ProfilePrivateDataRoles, type ProfileRoles, profileFirestoreCollection, profilePrivateDataFirestoreCollectionFactory, profilePrivateDataFirestoreCollectionGroup } from './profile';
import { APP_CODE_PREFIX_CAMELSystemStateStoredDataConverterMap } from './system';
// @dbx-addon:oidc:fb-service:imports

export abstract class APP_CODE_PREFIXFirestoreCollections implements FirestoreContextReference, ExampleFirestoreCollections, SystemStateFirestoreCollections, NotificationFirestoreCollections, StorageFileFirestoreCollections {
  // @dbx-addon:oidc:fb-service:implements
  abstract readonly firestoreContext: FirestoreContext;
  abstract readonly systemStateCollection: SystemStateFirestoreCollection;
  abstract readonly exampleCollection: ExampleFirestoreCollection;
  abstract readonly profileCollection: ProfileFirestoreCollection;
  abstract readonly profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
  abstract readonly profilePrivateDataCollectionGroup: ProfilePrivateDataFirestoreCollectionGroup;
  abstract readonly notificationUserCollection: NotificationUserFirestoreCollection;
  abstract readonly notificationSummaryCollection: NotificationSummaryFirestoreCollection;
  abstract readonly notificationBoxCollection: NotificationBoxFirestoreCollection;
  abstract readonly notificationCollectionFactory: NotificationFirestoreCollectionFactory;
  abstract readonly notificationCollectionGroup: NotificationFirestoreCollectionGroup;
  abstract readonly notificationWeekCollectionFactory: NotificationWeekFirestoreCollectionFactory;
  abstract readonly notificationWeekCollectionGroup: NotificationWeekFirestoreCollectionGroup;
  abstract readonly notificationLoggedEventDayCollectionFactory: NotificationLoggedEventDayFirestoreCollectionFactory;
  abstract readonly notificationLoggedEventDayCollectionGroup: NotificationLoggedEventDayFirestoreCollectionGroup;
  abstract readonly notificationLoggedEventDayPagedItemsCollectionFactory: NotificationLoggedEventDayPagedItemsFirestoreCollectionFactory;
  abstract readonly notificationLoggedEventDayPageCollectionGroup: NotificationLoggedEventDayPageFirestoreCollectionGroup;
  abstract readonly storageFileCollection: StorageFileFirestoreCollection;
  abstract readonly storageFileGroupCollection: StorageFileGroupFirestoreCollection;
  // @dbx-addon:oidc:fb-service:abstract
}

export function makeAPP_CODE_PREFIXFirestoreCollections(firestoreContext: FirestoreContext): APP_CODE_PREFIXFirestoreCollections {
  return {
    firestoreContext,
    systemStateCollection: systemStateFirestoreCollection(firestoreContext, APP_CODE_PREFIX_CAMELSystemStateStoredDataConverterMap),
    exampleCollection: exampleFirestoreCollection(firestoreContext),
    profileCollection: profileFirestoreCollection(firestoreContext),
    profilePrivateDataCollectionFactory: profilePrivateDataFirestoreCollectionFactory(firestoreContext),
    profilePrivateDataCollectionGroup: profilePrivateDataFirestoreCollectionGroup(firestoreContext),
    notificationUserCollection: notificationUserFirestoreCollection(firestoreContext),
    notificationSummaryCollection: notificationSummaryFirestoreCollection(firestoreContext),
    notificationBoxCollection: notificationBoxFirestoreCollection(firestoreContext),
    notificationCollectionFactory: notificationFirestoreCollectionFactory(firestoreContext),
    notificationCollectionGroup: notificationFirestoreCollectionGroup(firestoreContext),
    notificationWeekCollectionFactory: notificationWeekFirestoreCollectionFactory(firestoreContext),
    notificationWeekCollectionGroup: notificationWeekFirestoreCollectionGroup(firestoreContext),
    notificationLoggedEventDayCollectionFactory: notificationLoggedEventDayFirestoreCollectionFactory(firestoreContext),
    notificationLoggedEventDayCollectionGroup: notificationLoggedEventDayFirestoreCollectionGroup(firestoreContext),
    notificationLoggedEventDayPagedItemsCollectionFactory: notificationLoggedEventDayPagedItemsCollectionFactory(firestoreContext),
    notificationLoggedEventDayPageCollectionGroup: notificationLoggedEventDayPageFirestoreCollectionGroup(firestoreContext),
    storageFileCollection: storageFileFirestoreCollection(firestoreContext),
    storageFileGroupCollection: storageFileGroupFirestoreCollection(firestoreContext)
    // @dbx-addon:oidc:fb-service:factory
  };
}

// MARK: System
export const systemStateFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, SystemState, SystemStateDocument, SystemStateRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<SystemState, SystemStateDocument>, context: APP_CODE_PREFIXFirebaseContext, model: SystemStateDocument): PromiseOrValue<GrantedRoleMap<SystemStateRoles>> {
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.systemStateCollection
});

// MARK: Example
export const exampleFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, Example, ExampleDocument, ExampleRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Example, ExampleDocument>, context: APP_CODE_PREFIXFirebaseContext, model: ExampleDocument): PromiseOrValue<GrantedRoleMap<ExampleRoles>> {
    const roles: GrantedRoleMap<ExampleRoles> = noAccessRoleMap();

    // set roles here

    return roles;
  },
  getFirestoreCollection: (c) => c.app.exampleCollection
});

// MARK: Profile
export const profileFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, Profile, ProfileDocument, ProfileRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Profile, ProfileDocument>, context: APP_CODE_PREFIXFirebaseContext, model: ProfileDocument): PromiseOrValue<GrantedRoleMap<ProfileRoles>> {
    return grantFullAccessIfAuthUserRelated({ context, document: model });
  },
  getFirestoreCollection: (c) => c.app.profileCollection
});

export const profilePrivateDataFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, ProfilePrivateData, ProfilePrivateDataDocument, ProfilePrivateDataRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<ProfilePrivateData, ProfilePrivateDataDocument>, context: APP_CODE_PREFIXFirebaseContext, model: ProfilePrivateDataDocument): PromiseOrValue<GrantedRoleMap<ProfilePrivateDataRoles>> {
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.profilePrivateDataCollectionGroup
});

// MARK: NotificationBox
export const notificationUserFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, NotificationUser, NotificationUserDocument, NotificationUserRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationUser, NotificationUserDocument>, context: APP_CODE_PREFIXFirebaseContext, model: NotificationUserDocument): PromiseOrValue<GrantedRoleMap<NotificationUserRoles>> {
    return grantModelRolesIfAdmin(
      context,
      () => fullAccessRoleMap(),
      () => {
        return grantModelRolesIfAuthUserRelatedModelFunction(() => {
          const roles: NotificationUserRoles[] = ['read', 'update'];
          return grantedRoleKeysMapFromArray(roles);
        })({ context, model: { uid: model.id } });
      }
    );
  },
  getFirestoreCollection: (c) => c.app.notificationUserCollection
});

export const notificationSummaryFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, NotificationSummary, NotificationSummaryDocument, NotificationSummaryRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationSummary, NotificationSummaryDocument>, context: APP_CODE_PREFIXFirebaseContext, model: NotificationSummaryDocument): PromiseOrValue<GrantedRoleMap<NotificationSummaryRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationSummaryCollection
});

export const notificationBoxFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, NotificationBox, NotificationBoxDocument, NotificationBoxRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationBox, NotificationBoxDocument>, context: APP_CODE_PREFIXFirebaseContext, model: NotificationBoxDocument): PromiseOrValue<GrantedRoleMap<NotificationBoxRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationBoxCollection
});

export const notificationFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, Notification, NotificationDocument, NotificationRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Notification, NotificationDocument>, context: APP_CODE_PREFIXFirebaseContext, model: NotificationDocument): PromiseOrValue<GrantedRoleMap<NotificationRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationCollectionGroup
});

export const notificationWeekFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, NotificationWeek, NotificationWeekDocument, NotificationWeekRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationWeek, NotificationWeekDocument>, context: APP_CODE_PREFIXFirebaseContext, model: NotificationWeekDocument): PromiseOrValue<GrantedRoleMap<NotificationWeekRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationWeekCollectionGroup
});

export const notificationLoggedEventDayFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, NotificationLoggedEventDay, NotificationLoggedEventDayDocument, NotificationLoggedEventDayRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationLoggedEventDay, NotificationLoggedEventDayDocument>, context: APP_CODE_PREFIXFirebaseContext, model: NotificationLoggedEventDayDocument): PromiseOrValue<GrantedRoleMap<NotificationLoggedEventDayRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationLoggedEventDayCollectionGroup
});

export const notificationLoggedEventDayPageFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, NotificationLoggedEventDayPageDocumentData, NotificationLoggedEventDayPageDocument, NotificationLoggedEventDayRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationLoggedEventDayPageDocumentData, NotificationLoggedEventDayPageDocument>, context: APP_CODE_PREFIXFirebaseContext, model: NotificationLoggedEventDayPageDocument): PromiseOrValue<GrantedRoleMap<NotificationLoggedEventDayRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only — pages are framework-internal
  },
  getFirestoreCollection: (c) => c.app.notificationLoggedEventDayPageCollectionGroup
});

export const storageFileFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, StorageFile, StorageFileDocument, StorageFileRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<StorageFile, StorageFileDocument>, context: APP_CODE_PREFIXFirebaseContext, model: StorageFileDocument): PromiseOrValue<GrantedRoleMap<StorageFileRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.storageFileCollection
});

export const storageFileGroupFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, StorageFileGroup, StorageFileGroupDocument, StorageFileGroupRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<StorageFileGroup, StorageFileGroupDocument>, context: APP_CODE_PREFIXFirebaseContext, model: StorageFileGroupDocument): PromiseOrValue<GrantedRoleMap<StorageFileGroupRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.storageFileGroupCollection
});

// @dbx-addon:oidc:fb-service:model-service-factory

// MARK: Services
export type APP_CODE_PREFIXFirebaseModelTypes = SystemStateTypes | ExampleTypes | ProfileTypes | NotificationTypes | StorageFileTypes;
// @dbx-addon:oidc:fb-service:types-union

export type APP_CODE_PREFIXFirebaseContextAppContext = APP_CODE_PREFIXFirestoreCollections;

export type APP_CODE_PREFIXFirebaseBaseContext = FirebaseAppModelContext<APP_CODE_PREFIXFirebaseContextAppContext>;

export const APP_CODE_PREFIX_FIREBASE_MODEL_SERVICE_FACTORIES = {
  systemState: systemStateFirebaseModelServiceFactory,
  example: exampleFirebaseModelServiceFactory,
  profile: profileFirebaseModelServiceFactory,
  profilePrivate: profilePrivateDataFirebaseModelServiceFactory,
  notificationUser: notificationUserFirebaseModelServiceFactory,
  notificationSummary: notificationSummaryFirebaseModelServiceFactory,
  notificationBox: notificationBoxFirebaseModelServiceFactory,
  notification: notificationFirebaseModelServiceFactory,
  notificationWeek: notificationWeekFirebaseModelServiceFactory,
  notificationLoggedEventDay: notificationLoggedEventDayFirebaseModelServiceFactory,
  notificationLoggedEventDayPage: notificationLoggedEventDayPageFirebaseModelServiceFactory,
  storageFile: storageFileFirebaseModelServiceFactory,
  storageFileGroup: storageFileGroupFirebaseModelServiceFactory
  // @dbx-addon:oidc:fb-service:factories-map
};

export const APP_CODE_PREFIXFirebaseModelServices = firebaseModelsService<typeof APP_CODE_PREFIX_FIREBASE_MODEL_SERVICE_FACTORIES, APP_CODE_PREFIXFirebaseBaseContext, APP_CODE_PREFIXFirebaseModelTypes>(APP_CODE_PREFIX_FIREBASE_MODEL_SERVICE_FACTORIES);

export type APP_CODE_PREFIXFirebaseContext = APP_CODE_PREFIXFirebaseBaseContext & { service: typeof APP_CODE_PREFIXFirebaseModelServices };
