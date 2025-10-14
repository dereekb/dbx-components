import {
  FirebaseAppModelContext,
  firebaseModelServiceFactory,
  firebaseModelsService,
  FirebasePermissionServiceModel,
  FirestoreContext,
  FirestoreDocumentAccessor,
  grantFullAccessIfAdmin,
  grantFullAccessIfAuthUserRelated,
  grantModelRolesIfAdmin,
  grantModelRolesIfAuthUserRelatedModelFunction,
  NotificationBox,
  NotificationBoxDocument,
  notificationBoxFirestoreCollection,
  NotificationBoxFirestoreCollection,
  NotificationBoxRoles,
  Notification,
  NotificationDocument,
  notificationFirestoreCollectionFactory,
  NotificationFirestoreCollectionFactory,
  notificationFirestoreCollectionGroup,
  NotificationFirestoreCollectionGroup,
  NotificationFirestoreCollections,
  NotificationRoles,
  NotificationUser,
  NotificationUserDocument,
  notificationUserFirestoreCollection,
  NotificationUserFirestoreCollection,
  NotificationUserRoles,
  NotificationWeek,
  NotificationWeekDocument,
  notificationWeekFirestoreCollectionFactory,
  NotificationWeekFirestoreCollectionFactory,
  notificationWeekFirestoreCollectionGroup,
  NotificationWeekFirestoreCollectionGroup,
  NotificationWeekRoles,
  SystemState,
  SystemStateDocument,
  systemStateFirestoreCollection,
  SystemStateFirestoreCollection,
  SystemStateFirestoreCollections,
  SystemStateRoles,
  SystemStateStoredData,
  SystemStateTypes,
  FirestoreContextReference,
  NotificationSummaryFirestoreCollection,
  notificationSummaryFirestoreCollection,
  NotificationSummary,
  NotificationSummaryDocument,
  NotificationSummaryRoles,
  NotificationTypes,
  StorageFileFirestoreCollections,
  StorageFileFirestoreCollection,
  storageFileFirestoreCollection,
  StorageFile,
  StorageFileDocument,
  StorageFileRoles,
  StorageFileTypes
} from '@dereekb/firebase';
import { noAccessRoleMap, fullAccessRoleMap, grantedRoleKeysMapFromArray, GrantedRoleMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';
import { Example, ExampleDocument, ExampleRoles, ExampleTypes, exampleFirestoreCollection, ExampleFirestoreCollection, ExampleFirestoreCollections } from './example';
import { ProfileTypes, Profile, ProfileDocument, ProfileFirestoreCollection, ProfileFirestoreCollections, ProfilePrivateData, ProfilePrivateDataDocument, ProfilePrivateDataFirestoreCollectionFactory, ProfilePrivateDataFirestoreCollectionGroup, ProfilePrivateDataRoles, ProfileRoles, profileFirestoreCollection, profilePrivateDataFirestoreCollectionFactory, profilePrivateDataFirestoreCollectionGroup } from './profile';
import { APP_CODE_PREFIX_CAMELSystemStateStoredDataConverterMap } from './system';

export abstract class APP_CODE_PREFIXFirestoreCollections implements FirestoreContextReference, ExampleFirestoreCollections, SystemStateFirestoreCollections, NotificationFirestoreCollections, StorageFileFirestoreCollections {
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
  abstract readonly storageFileCollection: StorageFileFirestoreCollection;
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
    storageFileCollection: storageFileFirestoreCollection(firestoreContext)
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
    let roles: GrantedRoleMap<ExampleRoles> = noAccessRoleMap();

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

export const storageFileFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, StorageFile, StorageFileDocument, StorageFileRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<StorageFile, StorageFileDocument>, context: APP_CODE_PREFIXFirebaseContext, model: StorageFileDocument): PromiseOrValue<GrantedRoleMap<StorageFileRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.storageFileCollection
});

// MARK: Services
export type APP_CODE_PREFIXFirebaseModelTypes = SystemStateTypes | ExampleTypes | ProfileTypes | NotificationTypes | StorageFileTypes;

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
  storageFile: storageFileFirebaseModelServiceFactory
};

export const APP_CODE_PREFIXFirebaseModelServices = firebaseModelsService<typeof APP_CODE_PREFIX_FIREBASE_MODEL_SERVICE_FACTORIES, APP_CODE_PREFIXFirebaseBaseContext, APP_CODE_PREFIXFirebaseModelTypes>(APP_CODE_PREFIX_FIREBASE_MODEL_SERVICE_FACTORIES);

export type APP_CODE_PREFIXFirebaseContext = APP_CODE_PREFIXFirebaseBaseContext & { service: typeof APP_CODE_PREFIXFirebaseModelServices };
