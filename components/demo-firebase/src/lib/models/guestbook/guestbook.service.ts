import { Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument, GuestbookEntryRoles, GuestbookFirestoreCollections, GuestbookRoles } from './guestbook';
import { AbstractFirebasePermissionService, FirestoreCollection, FirebaseAppModelContext, FirebasePermissionServiceModel, FirestoreCollectionLike } from '@dereekb/firebase';
import { GrantedRoleMap, noAccessRolesMap } from '@dereekb/model';
import { PromiseOrValue } from '@dereekb/util';

export type GuestbookFirebaseContext = FirebaseAppModelContext<GuestbookFirestoreCollections>;

export class GuestbookFirebasePermissionService extends AbstractFirebasePermissionService<Guestbook, GuestbookFirebaseContext, GuestbookDocument, GuestbookRoles> {
  protected getFirestoreCollection(context: GuestbookFirebaseContext): FirestoreCollection<Guestbook, GuestbookDocument> {
    return context.app.guestbookCollection;
  }

  protected rolesMapForModel(model: FirebasePermissionServiceModel<Guestbook, GuestbookDocument>, context: GuestbookFirebaseContext): PromiseOrValue<GrantedRoleMap<GuestbookRoles>> {
    let roles: GrantedRoleMap<GuestbookRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  }
}

export class GuestbookEntryFirebasePermissionService extends AbstractFirebasePermissionService<GuestbookEntry, GuestbookFirebaseContext, GuestbookEntryDocument, GuestbookEntryRoles> {
  protected getFirestoreCollection(context: GuestbookFirebaseContext): FirestoreCollectionLike<GuestbookEntry, GuestbookEntryDocument> {
    return context.app.guestbookEntryCollectionGroup;
  }

  protected rolesMapForModel(model: FirebasePermissionServiceModel<GuestbookEntry, GuestbookEntryDocument>, context: GuestbookFirebaseContext): PromiseOrValue<GrantedRoleMap<GuestbookEntryRoles>> {
    let roles: GrantedRoleMap<GuestbookEntryRoles> = noAccessRolesMap();

    // todo: ...

    return roles;
  }
}
