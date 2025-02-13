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
  NotificationTypes
} from '@dereekb/firebase';
import { fullAccessRoleMap, grantedRoleKeysMapFromArray, GrantedRoleMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';
import { GuestbookTypes, GuestbookFirestoreCollections, Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument, GuestbookEntryFirestoreCollectionFactory, GuestbookEntryFirestoreCollectionGroup, GuestbookEntryRoles, GuestbookFirestoreCollection, GuestbookRoles, guestbookEntryFirestoreCollectionFactory, guestbookEntryFirestoreCollectionGroup, guestbookFirestoreCollection } from './guestbook';
import { ProfileTypes, Profile, ProfileDocument, ProfileFirestoreCollection, ProfileFirestoreCollections, ProfilePrivateData, ProfilePrivateDataDocument, ProfilePrivateDataFirestoreCollectionFactory, ProfilePrivateDataFirestoreCollectionGroup, ProfilePrivateDataRoles, ProfileRoles, profileFirestoreCollection, profilePrivateDataFirestoreCollectionFactory, profilePrivateDataFirestoreCollectionGroup } from './profile';
import { demoSystemStateStoredDataConverterMap, ExampleSystemData, EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE } from './system/system';

export abstract class DemoFirestoreCollections implements FirestoreContextReference, ProfileFirestoreCollections, GuestbookFirestoreCollections, SystemStateFirestoreCollections, NotificationFirestoreCollections {
  abstract readonly firestoreContext: FirestoreContext;
  abstract readonly systemStateCollection: SystemStateFirestoreCollection;
  abstract readonly guestbookCollection: GuestbookFirestoreCollection;
  abstract readonly guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
  abstract readonly guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
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
}

export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext): DemoFirestoreCollections {
  return {
    firestoreContext,
    systemStateCollection: systemStateFirestoreCollection(firestoreContext, demoSystemStateStoredDataConverterMap),
    guestbookCollection: guestbookFirestoreCollection(firestoreContext),
    guestbookEntryCollectionGroup: guestbookEntryFirestoreCollectionGroup(firestoreContext),
    guestbookEntryCollectionFactory: guestbookEntryFirestoreCollectionFactory(firestoreContext),
    profileCollection: profileFirestoreCollection(firestoreContext),
    profilePrivateDataCollectionFactory: profilePrivateDataFirestoreCollectionFactory(firestoreContext),
    profilePrivateDataCollectionGroup: profilePrivateDataFirestoreCollectionGroup(firestoreContext),
    notificationUserCollection: notificationUserFirestoreCollection(firestoreContext),
    notificationSummaryCollection: notificationSummaryFirestoreCollection(firestoreContext),
    notificationBoxCollection: notificationBoxFirestoreCollection(firestoreContext),
    notificationCollectionFactory: notificationFirestoreCollectionFactory(firestoreContext),
    notificationCollectionGroup: notificationFirestoreCollectionGroup(firestoreContext),
    notificationWeekCollectionFactory: notificationWeekFirestoreCollectionFactory(firestoreContext),
    notificationWeekCollectionGroup: notificationWeekFirestoreCollectionGroup(firestoreContext)
  };
}

// MARK: System
export const systemStateFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, SystemState, SystemStateDocument, SystemStateRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<SystemState, SystemStateDocument>, context: DemoFirebaseContext, model: SystemStateDocument): PromiseOrValue<GrantedRoleMap<SystemStateRoles>> {
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.systemStateCollection
});

// MARK: Guestbook
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Guestbook, GuestbookDocument, GuestbookRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Guestbook, GuestbookDocument>, context: DemoFirebaseContext, model: GuestbookDocument): PromiseOrValue<GrantedRoleMap<GuestbookRoles>> {
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.guestbookCollection
});

export const guestbookEntryFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, GuestbookEntry, GuestbookEntryDocument, GuestbookEntryRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<GuestbookEntry, GuestbookEntryDocument>, context: DemoFirebaseContext, model: GuestbookEntryDocument): PromiseOrValue<GrantedRoleMap<GuestbookEntryRoles>> {
    return grantFullAccessIfAuthUserRelated({ context, document: model });
  },
  getFirestoreCollection: (c) => c.app.guestbookEntryCollectionGroup
});

// MARK: Profile
export const profileFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Profile, ProfileDocument, ProfileRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Profile, ProfileDocument>, context: DemoFirebaseContext, model: ProfileDocument): PromiseOrValue<GrantedRoleMap<ProfileRoles>> {
    return grantFullAccessIfAuthUserRelated({ context, document: model });
  },
  getFirestoreCollection: (c) => c.app.profileCollection
});

export const profilePrivateDataFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, ProfilePrivateData, ProfilePrivateDataDocument, ProfilePrivateDataRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<ProfilePrivateData, ProfilePrivateDataDocument>, context: DemoFirebaseContext, model: ProfilePrivateDataDocument): PromiseOrValue<GrantedRoleMap<ProfilePrivateDataRoles>> {
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.profilePrivateDataCollectionGroup
});

// MARK: NotificationBox
export const notificationUserFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, NotificationUser, NotificationUserDocument, NotificationUserRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationUser, NotificationUserDocument>, context: DemoFirebaseContext, model: NotificationUserDocument): PromiseOrValue<GrantedRoleMap<NotificationUserRoles>> {
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

export const notificationSummaryFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, NotificationSummary, NotificationSummaryDocument, NotificationSummaryRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationSummary, NotificationSummaryDocument>, context: DemoFirebaseContext, model: NotificationSummaryDocument): PromiseOrValue<GrantedRoleMap<NotificationSummaryRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationSummaryCollection
});

export const notificationBoxFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, NotificationBox, NotificationBoxDocument, NotificationBoxRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationBox, NotificationBoxDocument>, context: DemoFirebaseContext, model: NotificationBoxDocument): PromiseOrValue<GrantedRoleMap<NotificationBoxRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationBoxCollection
});

export const notificationFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Notification, NotificationDocument, NotificationRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Notification, NotificationDocument>, context: DemoFirebaseContext, model: NotificationDocument): PromiseOrValue<GrantedRoleMap<NotificationRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationCollectionGroup
});

export const notificationWeekFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, NotificationWeek, NotificationWeekDocument, NotificationWeekRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationWeek, NotificationWeekDocument>, context: DemoFirebaseContext, model: NotificationWeekDocument): PromiseOrValue<GrantedRoleMap<NotificationWeekRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationWeekCollectionGroup
});

// MARK: Services
export type DemoFirebaseModelTypes = SystemStateTypes | GuestbookTypes | ProfileTypes | NotificationTypes;

export type DemoFirebaseContextAppContext = DemoFirestoreCollections;

export type DemoFirebaseBaseContext = FirebaseAppModelContext<DemoFirebaseContextAppContext>;

export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
  systemState: systemStateFirebaseModelServiceFactory,
  guestbook: guestbookFirebaseModelServiceFactory,
  guestbookEntry: guestbookEntryFirebaseModelServiceFactory,
  profile: profileFirebaseModelServiceFactory,
  profilePrivate: profilePrivateDataFirebaseModelServiceFactory,
  notificationUser: notificationUserFirebaseModelServiceFactory,
  notificationSummary: notificationSummaryFirebaseModelServiceFactory,
  notificationBox: notificationBoxFirebaseModelServiceFactory,
  notification: notificationFirebaseModelServiceFactory,
  notificationWeek: notificationWeekFirebaseModelServiceFactory
};

export type DemoFirebaseModelServiceFactories = typeof DEMO_FIREBASE_MODEL_SERVICE_FACTORIES;

export const demoFirebaseModelServices = firebaseModelsService<DemoFirebaseModelServiceFactories, DemoFirebaseBaseContext, DemoFirebaseModelTypes>(DEMO_FIREBASE_MODEL_SERVICE_FACTORIES);

export type DemoFirebaseContext = DemoFirebaseBaseContext & { service: DemoFirebaseModelServiceFactories };

// MARK: System
export function loadExampleSystemState(accessor: FirestoreDocumentAccessor<SystemState<SystemStateStoredData>, SystemStateDocument<SystemStateStoredData>>): SystemStateDocument<ExampleSystemData> {
  return accessor.loadDocumentForId(EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE) as SystemStateDocument<ExampleSystemData>;
}
