import { Profile, ProfileDocument, ProfileFirestoreCollections, ProfileRoles } from './profile';
import { AbstractFirebasePermissionService, FirebaseAppModelContext, FirebasePermissionServiceModel, FirestoreCollectionLike } from '@dereekb/firebase';
import { GrantedRoleMap, noAccessRolesMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';

export type ProfileFirebaseContext = FirebaseAppModelContext<ProfileFirestoreCollections>;

export class ProfileFirebasePermissionService extends AbstractFirebasePermissionService<Profile, ProfileFirebaseContext, ProfileDocument, ProfileRoles> {
  protected getFirestoreCollection(context: ProfileFirebaseContext): FirestoreCollectionLike<Profile, ProfileDocument> {
    return context.app.profileCollection;
  }

  protected rolesMapForModel(model: FirebasePermissionServiceModel<Profile, ProfileDocument>, context: ProfileFirebaseContext): PromiseOrValue<GrantedRoleMap<ProfileRoles>> {
    let roles: GrantedRoleMap<ProfileRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  }
}
