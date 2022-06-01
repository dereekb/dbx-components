import { Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument, GuestbookEntryRoles, GuestbookFirestoreCollections, GuestbookRoles } from './guestbook';
import { FirebaseAppModelContext, FirebasePermissionServiceModel, firebaseModelServiceFactory } from '@dereekb/firebase';
import { GrantedRoleMap, noAccessRolesMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';

export type GuestbookFirebaseContext = FirebaseAppModelContext<GuestbookFirestoreCollections>;

export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory<GuestbookFirebaseContext, Guestbook, GuestbookDocument, GuestbookRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<Guestbook, GuestbookDocument>, context: GuestbookFirebaseContext, model: GuestbookDocument): PromiseOrValue<GrantedRoleMap<GuestbookRoles>> {
    let roles: GrantedRoleMap<GuestbookRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  },
  getFirestoreCollection: (c) => c.app.guestbookCollection
});

export const guestbookEntryFirebaseModelServiceFactory = firebaseModelServiceFactory<GuestbookFirebaseContext, GuestbookEntry, GuestbookEntryDocument, GuestbookEntryRoles>({
  rolesMapForModel: function (output: FirebasePermissionServiceModel<GuestbookEntry, GuestbookEntryDocument>, context: GuestbookFirebaseContext, model: GuestbookEntryDocument): PromiseOrValue<GrantedRoleMap<GuestbookEntryRoles>> {
    let roles: GrantedRoleMap<GuestbookEntryRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  },
  getFirestoreCollection: (c) => c.app.guestbookEntryCollectionGroup
});
