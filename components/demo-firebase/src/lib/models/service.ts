import { FirebaseAppModelContext, firebaseModelServiceFactory, firebaseModelsService, FirebasePermissionServiceModel, FirestoreContext } from '@dereekb/firebase';
import { GrantedRoleMap, noAccessRolesMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';
import { GuestbookTypes, GuestbookFirestoreCollections, Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument, GuestbookEntryFirestoreCollectionFactory, GuestbookEntryFirestoreCollectionGroup, GuestbookEntryRoles, GuestbookFirestoreCollection, GuestbookRoles, guestbookEntryFirestoreCollectionFactory, guestbookEntryFirestoreCollectionGroup, guestbookFirestoreCollection } from './guestbook';
import { ProfileTypes, Profile, ProfileDocument, ProfileFirestoreCollection, ProfileFirestoreCollections, ProfilePrivateData, ProfilePrivateDataDocument, ProfilePrivateDataFirestoreCollectionFactory, ProfilePrivateDataFirestoreCollectionGroup, ProfilePrivateDataRoles, ProfileRoles, profileFirestoreCollection, profilePrivateDataFirestoreCollectionFactory, profilePrivateDataFirestoreCollectionGroup } from './profile';

export abstract class DemoFirestoreCollections implements ProfileFirestoreCollections, GuestbookFirestoreCollections {
  abstract readonly guestbookCollection: GuestbookFirestoreCollection;
  abstract readonly guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
  abstract readonly guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
  abstract readonly profileCollection: ProfileFirestoreCollection;
  abstract readonly profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
  abstract readonly profilePrivateDataCollectionGroup: ProfilePrivateDataFirestoreCollectionGroup;
}

export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext): DemoFirestoreCollections {
  return {
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
  rolesMapForModel: function (output: FirebasePermissionServiceModel<Guestbook, GuestbookDocument>, context: DemoFirebaseContext, model: GuestbookDocument): PromiseOrValue<GrantedRoleMap<GuestbookRoles>> {
    let roles: GrantedRoleMap<GuestbookRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  },
  getFirestoreCollection: (c) => c.app.guestbookCollection
});

export const guestbookEntryFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, GuestbookEntry, GuestbookEntryDocument, GuestbookEntryRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<GuestbookEntry, GuestbookEntryDocument>, context: DemoFirebaseContext, model: GuestbookEntryDocument): PromiseOrValue<GrantedRoleMap<GuestbookEntryRoles>> {
    let roles: GrantedRoleMap<GuestbookEntryRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  },
  getFirestoreCollection: (c) => c.app.guestbookEntryCollectionGroup
});

// MARK: Profile
export const profileFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Profile, ProfileDocument, ProfileRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<Profile, ProfileDocument>, context: DemoFirebaseContext, model: ProfileDocument): PromiseOrValue<GrantedRoleMap<ProfileRoles>> {
    let roles: GrantedRoleMap<ProfileRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  },
  getFirestoreCollection: (c) => c.app.profileCollection
});

export const profilePrivateDataFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, ProfilePrivateData, ProfilePrivateDataDocument, ProfilePrivateDataRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<ProfilePrivateData, ProfilePrivateDataDocument>, context: DemoFirebaseContext, model: ProfilePrivateDataDocument): PromiseOrValue<GrantedRoleMap<ProfilePrivateDataRoles>> {
    let roles: GrantedRoleMap<ProfilePrivateDataRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  },
  getFirestoreCollection: (c) => c.app.profilePrivateDataCollectionGroup
});

// MARK: Services
export type DemoFirebaseModelTypes = GuestbookTypes | ProfileTypes;

export type DemoFirebaseBaseContext = FirebaseAppModelContext<DemoFirestoreCollections>;

export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
  guestbook: guestbookFirebaseModelServiceFactory,
  guestbookentry: guestbookEntryFirebaseModelServiceFactory,
  profile: profileFirebaseModelServiceFactory,
  profileprivate: profilePrivateDataFirebaseModelServiceFactory
};

export const demoFirebaseModelServices = firebaseModelsService<typeof DEMO_FIREBASE_MODEL_SERVICE_FACTORIES, DemoFirebaseBaseContext, DemoFirebaseModelTypes>(DEMO_FIREBASE_MODEL_SERVICE_FACTORIES);

export type DemoFirebaseContext = DemoFirebaseBaseContext & { service: typeof demoFirebaseModelServices };
