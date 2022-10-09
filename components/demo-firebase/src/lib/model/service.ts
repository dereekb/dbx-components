import { FirebaseAppModelContext, firebaseModelServiceFactory, firebaseModelsService, FirebasePermissionServiceModel, FirestoreContext, FirestoreDocumentAccessor, grantFullAccessIfAdmin, grantFullAccessIfAuthUserRelated, SystemState, SystemStateDocument, systemStateFirestoreCollection, SystemStateFirestoreCollection, SystemStateFirestoreCollections, SystemStateStoredData } from '@dereekb/firebase';
import { GrantedRoleMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';
import { GuestbookTypes, GuestbookFirestoreCollections, Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument, GuestbookEntryFirestoreCollectionFactory, GuestbookEntryFirestoreCollectionGroup, GuestbookEntryRoles, GuestbookFirestoreCollection, GuestbookRoles, guestbookEntryFirestoreCollectionFactory, guestbookEntryFirestoreCollectionGroup, guestbookFirestoreCollection } from './guestbook';
import { ProfileTypes, Profile, ProfileDocument, ProfileFirestoreCollection, ProfileFirestoreCollections, ProfilePrivateData, ProfilePrivateDataDocument, ProfilePrivateDataFirestoreCollectionFactory, ProfilePrivateDataFirestoreCollectionGroup, ProfilePrivateDataRoles, ProfileRoles, profileFirestoreCollection, profilePrivateDataFirestoreCollectionFactory, profilePrivateDataFirestoreCollectionGroup } from './profile';
import { demoSystemStateStoredDataConverterMap, ExampleSystemData, EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE } from './system/system';

export abstract class DemoFirestoreCollections implements ProfileFirestoreCollections, GuestbookFirestoreCollections, SystemStateFirestoreCollections {
  abstract readonly systemStateCollection: SystemStateFirestoreCollection;
  abstract readonly guestbookCollection: GuestbookFirestoreCollection;
  abstract readonly guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
  abstract readonly guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
  abstract readonly profileCollection: ProfileFirestoreCollection;
  abstract readonly profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
  abstract readonly profilePrivateDataCollectionGroup: ProfilePrivateDataFirestoreCollectionGroup;
}

export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext): DemoFirestoreCollections {
  return {
    systemStateCollection: systemStateFirestoreCollection(firestoreContext, demoSystemStateStoredDataConverterMap),
    guestbookCollection: guestbookFirestoreCollection(firestoreContext),
    guestbookEntryCollectionGroup: guestbookEntryFirestoreCollectionGroup(firestoreContext),
    guestbookEntryCollectionFactory: guestbookEntryFirestoreCollectionFactory(firestoreContext),
    profileCollection: profileFirestoreCollection(firestoreContext),
    profilePrivateDataCollectionFactory: profilePrivateDataFirestoreCollectionFactory(firestoreContext),
    profilePrivateDataCollectionGroup: profilePrivateDataFirestoreCollectionGroup(firestoreContext)
  };
}

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

// MARK: Services
export type DemoFirebaseModelTypes = GuestbookTypes | ProfileTypes;

export type DemoFirebaseContextAppContext = DemoFirestoreCollections;

export type DemoFirebaseBaseContext = FirebaseAppModelContext<DemoFirebaseContextAppContext>;

export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
  guestbook: guestbookFirebaseModelServiceFactory,
  guestbookEntry: guestbookEntryFirebaseModelServiceFactory,
  profile: profileFirebaseModelServiceFactory,
  profilePrivate: profilePrivateDataFirebaseModelServiceFactory
};

export type DemoFirebaseModelServiceFactories = typeof DEMO_FIREBASE_MODEL_SERVICE_FACTORIES;

export const demoFirebaseModelServices = firebaseModelsService<DemoFirebaseModelServiceFactories, DemoFirebaseBaseContext, DemoFirebaseModelTypes>(DEMO_FIREBASE_MODEL_SERVICE_FACTORIES);

export type DemoFirebaseContext = DemoFirebaseBaseContext & { service: DemoFirebaseModelServiceFactories };

// MARK: System
export function loadExampleSystemState(accessor: FirestoreDocumentAccessor<SystemState<SystemStateStoredData>, SystemStateDocument<SystemStateStoredData>>): SystemStateDocument<ExampleSystemData> {
  return accessor.loadDocumentForId(EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE) as SystemStateDocument<ExampleSystemData>;
}
