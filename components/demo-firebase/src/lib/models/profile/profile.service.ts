import { Profile, ProfileDocument, ProfileFirestoreCollections, ProfilePrivateData, ProfilePrivateDataDocument, ProfilePrivateDataRoles, ProfileRoles } from './profile';
import { FirebaseAppModelContext, FirebasePermissionServiceModel, FirebaseModelServiceConfig, FirebaseModelService, firebaseModelService, firebaseModelServiceFactory, FirebaseModelServiceFactory } from '@dereekb/firebase';
import { GrantedRoleMap, noAccessRolesMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';

export type ProfileFirebaseContext = FirebaseAppModelContext<ProfileFirestoreCollections>;

export const profileFirebaseModelServiceFactory = firebaseModelServiceFactory<ProfileFirebaseContext, Profile, ProfileDocument, ProfileRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<Profile, ProfileDocument>, context: ProfileFirebaseContext, model: ProfileDocument): PromiseOrValue<GrantedRoleMap<ProfileRoles>> {
    let roles: GrantedRoleMap<ProfileRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  },
  getFirestoreCollection: (c) => c.app.profileCollection
});

export const profilePrivateDataFirebaseModelServiceFactory = firebaseModelServiceFactory<ProfileFirebaseContext, ProfilePrivateData, ProfilePrivateDataDocument, ProfilePrivateDataRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<ProfilePrivateData, ProfilePrivateDataDocument>, context: ProfileFirebaseContext, model: ProfilePrivateDataDocument): PromiseOrValue<GrantedRoleMap<ProfilePrivateDataRoles>> {
    let roles: GrantedRoleMap<ProfilePrivateDataRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  },
  getFirestoreCollection: (c) => c.app.profilePrivateDataCollectionGroup
});
