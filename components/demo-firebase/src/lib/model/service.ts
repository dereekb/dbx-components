import {
  type FirebaseAppModelContext,
  firebaseModelServiceFactory,
  firebaseModelsService,
  type FirebasePermissionServiceModel,
  type FirestoreContext,
  type FirestoreDocumentAccessor,
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
  type SystemStateStoredData,
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
  grantStorageFileRolesForUserAuthFunction,
  storageFileGroupFirestoreCollection,
  type StorageFileGroupFirestoreCollection,
  type StorageFileGroup,
  type StorageFileGroupDocument,
  type StorageFileGroupRoles,
  type OidcEntryFirestoreCollection,
  oidcEntryFirestoreCollection,
  type OidcModelTypes,
  type OidcEntry,
  type OidcEntryDocument,
  type OidcEntryRoles,
  type OidcModelFirestoreCollections,
  firestoreModelKey,
  type UserExternalConnection,
  type UserExternalConnectionDocument,
  type UserExternalConnectionFirestoreCollection,
  type UserExternalConnectionFirestoreCollections,
  type UserExternalConnectionRoles,
  type UserExternalConnectionTypes,
  userExternalConnectionFirestoreCollection,
  type FormSpace,
  type FormSpaceDocument,
  type FormSpaceFirestoreCollection,
  type FormSpaceFirestoreCollections,
  type FormSpaceRoles,
  type FormSpaceTypes,
  formSpaceFirestoreCollection,
  grantFormSpaceRolesForUserAuthFunction,
  isFormSpaceStorageFileAccessibleByUser,
  type Calendar,
  type CalendarDocument,
  type CalendarFirestoreCollection,
  type CalendarFirestoreCollections,
  type CalendarRoles,
  type CalendarTypes,
  calendarFirestoreCollection
} from '@dereekb/firebase';
import {
  type OpenRouterPrompt,
  type OpenRouterPromptDocument,
  type OpenRouterPromptRoles,
  type OpenRouterPromptTypes,
  type OpenRouterPromptVersion,
  type OpenRouterPromptVersionDocument,
  type OpenRouterPromptVersionRoles,
  type OpenRouterPromptFirestoreCollection,
  type OpenRouterPromptFirestoreCollections,
  type OpenRouterPromptVersionFirestoreCollectionFactory,
  type OpenRouterPromptVersionFirestoreCollectionGroup,
  type OpenRouterRunTaskFirestoreCollection,
  type OpenRouterRunTaskFirestoreCollections,
  openRouterPromptFirestoreCollection,
  openRouterPromptVersionFirestoreCollectionFactory,
  openRouterPromptVersionFirestoreCollectionGroup,
  openRouterRunTaskFirestoreCollection
} from '@dereekb/openrouter/firebase';
import { fullAccessRoleMap, grantedRoleKeysMapFromArray, type GrantedRoleMap, noAccessRoleMap } from '@dereekb/model';
import { type PromiseOrValue } from '@dereekb/util';
import { type GuestbookTypes, type GuestbookFirestoreCollections, type Guestbook, type GuestbookDocument, type GuestbookEntry, type GuestbookEntryDocument, type GuestbookEntryFirestoreCollectionFactory, type GuestbookEntryFirestoreCollectionGroup, type GuestbookEntryRoles, type GuestbookFirestoreCollection, type GuestbookRoles, guestbookEntryFirestoreCollectionFactory, guestbookEntryFirestoreCollectionGroup, guestbookFirestoreCollection, isGuestbookOwnershipKeySignedByUser } from './guestbook';
import { type ProfileTypes, type Profile, type ProfileDocument, type ProfileFirestoreCollection, type ProfileFirestoreCollections, type ProfilePrivate, type ProfilePrivateDocument, type ProfilePrivateFirestoreCollectionFactory, type ProfilePrivateFirestoreCollectionGroup, type ProfilePrivateRoles, type ProfileRoles, profileFirestoreCollection, profilePrivateFirestoreCollectionFactory, profilePrivateFirestoreCollectionGroup, profileIdentity } from './profile';
import { DEMO_FORM_SPACE_TYPE_CONFIG_SERVICE } from './formspace/formspace';
import { demoSystemStateStoredDataConverterMap, type ExampleSystemData, EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE } from './system/system';

export abstract class DemoFirestoreCollections implements FirestoreContextReference, ProfileFirestoreCollections, GuestbookFirestoreCollections, SystemStateFirestoreCollections, NotificationFirestoreCollections, StorageFileFirestoreCollections, CalendarFirestoreCollections, FormSpaceFirestoreCollections, OidcModelFirestoreCollections, UserExternalConnectionFirestoreCollections, OpenRouterPromptFirestoreCollections, OpenRouterRunTaskFirestoreCollections {
  abstract readonly firestoreContext: FirestoreContext;
  abstract readonly systemStateCollection: SystemStateFirestoreCollection;
  abstract readonly guestbookCollection: GuestbookFirestoreCollection;
  abstract readonly guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
  abstract readonly guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
  abstract readonly profileCollection: ProfileFirestoreCollection;
  abstract readonly profilePrivateCollectionFactory: ProfilePrivateFirestoreCollectionFactory;
  abstract readonly profilePrivateCollectionGroup: ProfilePrivateFirestoreCollectionGroup;
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
  abstract readonly calendarCollection: CalendarFirestoreCollection;
  abstract readonly formSpaceCollection: FormSpaceFirestoreCollection;
  abstract readonly oidcEntryCollection: OidcEntryFirestoreCollection;
  abstract readonly userExternalConnectionCollection: UserExternalConnectionFirestoreCollection;
  abstract readonly openRouterPromptCollection: OpenRouterPromptFirestoreCollection;
  abstract readonly openRouterPromptVersionCollectionFactory: OpenRouterPromptVersionFirestoreCollectionFactory;
  abstract readonly openRouterPromptVersionCollectionGroup: OpenRouterPromptVersionFirestoreCollectionGroup;
  abstract readonly openRouterRunTaskCollection: OpenRouterRunTaskFirestoreCollection;
}

/**
 * Creates all Firestore collection accessors for the demo application.
 *
 * Instantiates every model collection, subcollection factory, and collection group
 * defined in DemoFirestoreCollections using the provided Firestore context.
 *
 * @param firestoreContext - The FirestoreContext used to build all collections.
 * @returns A fully populated DemoFirestoreCollections instance.
 */
export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext): DemoFirestoreCollections {
  return {
    firestoreContext,
    systemStateCollection: systemStateFirestoreCollection(firestoreContext, demoSystemStateStoredDataConverterMap),
    guestbookCollection: guestbookFirestoreCollection(firestoreContext),
    guestbookEntryCollectionGroup: guestbookEntryFirestoreCollectionGroup(firestoreContext),
    guestbookEntryCollectionFactory: guestbookEntryFirestoreCollectionFactory(firestoreContext),
    profileCollection: profileFirestoreCollection(firestoreContext),
    profilePrivateCollectionFactory: profilePrivateFirestoreCollectionFactory(firestoreContext),
    profilePrivateCollectionGroup: profilePrivateFirestoreCollectionGroup(firestoreContext),
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
    storageFileGroupCollection: storageFileGroupFirestoreCollection(firestoreContext),
    calendarCollection: calendarFirestoreCollection(firestoreContext),
    formSpaceCollection: formSpaceFirestoreCollection(firestoreContext),
    oidcEntryCollection: oidcEntryFirestoreCollection({ firestoreContext }),
    userExternalConnectionCollection: userExternalConnectionFirestoreCollection(firestoreContext),
    openRouterPromptCollection: openRouterPromptFirestoreCollection(firestoreContext),
    openRouterPromptVersionCollectionFactory: openRouterPromptVersionFirestoreCollectionFactory(firestoreContext),
    openRouterPromptVersionCollectionGroup: openRouterPromptVersionFirestoreCollectionGroup(firestoreContext),
    openRouterRunTaskCollection: openRouterRunTaskFirestoreCollection(firestoreContext)
  };
}

// MARK: System
/**
 * @dbxModelServiceFactory systemState
 */
export const systemStateFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, SystemState, SystemStateDocument, SystemStateRoles>({
  // SERVER-ONLY: firestore.rules has no match block for `sys`, so no client can read it there.
  // Without this flag the model API — which authorizes via roleMapForModel under the Admin SDK and
  // never consults the rules — would hand the document to a client anyway.
  serverOnly: true,
  roleMapForModel: function (output: FirebasePermissionServiceModel<SystemState, SystemStateDocument>, context: DemoFirebaseContext, _model: SystemStateDocument): PromiseOrValue<GrantedRoleMap<SystemStateRoles>> {
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.systemStateCollection
});

// MARK: Guestbook
/**
 * @dbxModelServiceFactory guestbook
 */
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Guestbook, GuestbookDocument, GuestbookRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Guestbook, GuestbookDocument>, context: DemoFirebaseContext, _model: GuestbookDocument): PromiseOrValue<GrantedRoleMap<GuestbookRoles>> {
    return grantFullAccessIfAdmin(context, () => {
      const roles: GuestbookRoles[] = [];

      // the creator can read and publish their own guestbook
      if (context.auth?.uid && output.data?.cby === context.auth.uid) {
        roles.push('read', 'publish');
      }

      // a published guestbook is readable by anyone
      if (output.data?.published) {
        roles.push('read');
      }

      return grantedRoleKeysMapFromArray(roles);
    });
  },
  getFirestoreCollection: (c) => c.app.guestbookCollection
});

/**
 * @dbxModelServiceFactory guestbookEntry
 */
export const guestbookEntryFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, GuestbookEntry, GuestbookEntryDocument, GuestbookEntryRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<GuestbookEntry, GuestbookEntryDocument>, context: DemoFirebaseContext, model: GuestbookEntryDocument): PromiseOrValue<GrantedRoleMap<GuestbookEntryRoles>> {
    return grantFullAccessIfAuthUserRelated({ context, document: model }, () => {
      let roles: GuestbookEntryRoles[] = [];

      if (context.auth) {
        roles = ['like']; // if a user is logged in then they can "like" something
      }

      return grantedRoleKeysMapFromArray(roles);
    });
  },
  getFirestoreCollection: (c) => c.app.guestbookEntryCollectionGroup
});

// MARK: Profile
/**
 * @dbxModelServiceFactory profile
 */
export const profileFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Profile, ProfileDocument, ProfileRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Profile, ProfileDocument>, context: DemoFirebaseContext, model: ProfileDocument): PromiseOrValue<GrantedRoleMap<ProfileRoles>> {
    return grantFullAccessIfAuthUserRelated({ context, document: model });
  },
  getFirestoreCollection: (c) => c.app.profileCollection
});

/**
 * @dbxModelServiceFactory profilePrivate
 */
export const profilePrivateFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, ProfilePrivate, ProfilePrivateDocument, ProfilePrivateRoles>({
  // SERVER-ONLY: firestore.rules has no match block for `pp`, so no client can read it there.
  // Without this flag the model API — which authorizes via roleMapForModel under the Admin SDK and
  // never consults the rules — would hand the document to a client anyway.
  serverOnly: true,
  roleMapForModel: function (output: FirebasePermissionServiceModel<ProfilePrivate, ProfilePrivateDocument>, context: DemoFirebaseContext, _model: ProfilePrivateDocument): PromiseOrValue<GrantedRoleMap<ProfilePrivateRoles>> {
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.profilePrivateCollectionGroup
});

// MARK: NotificationBox
/**
 * @dbxModelServiceFactory notificationUser
 */
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

/**
 * @dbxModelServiceFactory notificationSummary
 */
export const notificationSummaryFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, NotificationSummary, NotificationSummaryDocument, NotificationSummaryRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationSummary, NotificationSummaryDocument>, context: DemoFirebaseContext, _model: NotificationSummaryDocument): PromiseOrValue<GrantedRoleMap<NotificationSummaryRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationSummaryCollection
});

/**
 * @dbxModelServiceFactory notificationBox
 */
export const notificationBoxFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, NotificationBox, NotificationBoxDocument, NotificationBoxRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationBox, NotificationBoxDocument>, context: DemoFirebaseContext, _model: NotificationBoxDocument): PromiseOrValue<GrantedRoleMap<NotificationBoxRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationBoxCollection
});

/**
 * @dbxModelServiceFactory notification
 */
export const notificationFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Notification, NotificationDocument, NotificationRoles>({
  // SERVER-ONLY: firestore.rules has `allow read: if false` for `nbn`, so no client can read it there.
  // Without this flag the model API — which authorizes via roleMapForModel under the Admin SDK and
  // never consults the rules — would hand the document to a client anyway.
  serverOnly: true,
  roleMapForModel: function (output: FirebasePermissionServiceModel<Notification, NotificationDocument>, context: DemoFirebaseContext, _model: NotificationDocument): PromiseOrValue<GrantedRoleMap<NotificationRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationCollectionGroup
});

/**
 * @dbxModelServiceFactory notificationWeek
 */
export const notificationWeekFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, NotificationWeek, NotificationWeekDocument, NotificationWeekRoles>({
  // SERVER-ONLY: firestore.rules has `allow read: if false` for `nbnw`, so no client can read it there.
  // Without this flag the model API — which authorizes via roleMapForModel under the Admin SDK and
  // never consults the rules — would hand the document to a client anyway.
  serverOnly: true,
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationWeek, NotificationWeekDocument>, context: DemoFirebaseContext, _model: NotificationWeekDocument): PromiseOrValue<GrantedRoleMap<NotificationWeekRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationWeekCollectionGroup
});

/**
 * @dbxModelServiceFactory notificationLoggedEventDay
 */
export const notificationLoggedEventDayFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, NotificationLoggedEventDay, NotificationLoggedEventDayDocument, NotificationLoggedEventDayRoles>({
  // SERVER-ONLY: firestore.rules has no match block for `nbnle`, so no client can read it there.
  // Without this flag the model API — which authorizes via roleMapForModel under the Admin SDK and
  // never consults the rules — would hand the document to a client anyway.
  serverOnly: true,
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationLoggedEventDay, NotificationLoggedEventDayDocument>, context: DemoFirebaseContext, _model: NotificationLoggedEventDayDocument): PromiseOrValue<GrantedRoleMap<NotificationLoggedEventDayRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.notificationLoggedEventDayCollectionGroup
});

/**
 * @dbxModelServiceFactory notificationLoggedEventDayPage
 */
export const notificationLoggedEventDayPageFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, NotificationLoggedEventDayPageDocumentData, NotificationLoggedEventDayPageDocument, NotificationLoggedEventDayRoles>({
  // SERVER-ONLY: firestore.rules has no match block for `nbnlep`, so no client can read it there.
  // `NotificationLoggedEventDayPageDocumentData` is a type alias, not an interface, so there is no
  // declaration to carry `@dbxModelServerOnly` — this flag is the whole declaration for this model.
  serverOnly: true,
  roleMapForModel: function (output: FirebasePermissionServiceModel<NotificationLoggedEventDayPageDocumentData, NotificationLoggedEventDayPageDocument>, context: DemoFirebaseContext, _model: NotificationLoggedEventDayPageDocument): PromiseOrValue<GrantedRoleMap<NotificationLoggedEventDayRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only — pages are framework-internal
  },
  getFirestoreCollection: (c) => c.app.notificationLoggedEventDayPageCollectionGroup
});

/**
 * @dbxModelServiceFactory storageFile
 */
export const storageFileFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, StorageFile, StorageFileDocument, StorageFileRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<StorageFile, StorageFileDocument>, context: DemoFirebaseContext, model: StorageFileDocument): PromiseOrValue<GrantedRoleMap<StorageFileRoles>> {
    const grantStorageFileRolesForUser = grantStorageFileRolesForUserAuthFunction({ output, context, model });
    const uid = context.auth?.uid;
    const storageFile = output.data;

    // The FormSpace half of "may this caller see this file". ABSTAINS — returns true — for every file that
    // is not a FormSpace upload, so it composes as an AND with the grants below rather than replacing them,
    // and it costs no read at all when the caller is the file's own `uby`.
    const formSpaceFileAccessAllows = async (): Promise<boolean> => (storageFile == null ? true : isFormSpaceStorageFileAccessibleByUser({ collections: context.app, appFormSpaceTypeConfigService: DEMO_FORM_SPACE_TYPE_CONFIG_SERVICE, storageFile, uid }));

    return grantModelRolesIfAdmin(
      context,
      fullAccessRoleMap(),
      grantStorageFileRolesForUser({
        rolesForStorageFileUser: async () => {
          // user can read and download any file that belongs to them — unless it is a FormSpace file whose
          // type narrows access to its uploader. On a shared album `u` is the space's owner, so without the
          // narrowing this branch would hand them every member's photo.
          return (await formSpaceFileAccessAllows()) ? { read: true, download: true } : undefined;
        },
        // A server-derived file has no `u` — nothing uploaded it — and carries only the `o` of the model it
        // was derived from, so the `u` branch above grants nothing and the owner cannot download their own
        // artifact. `firestore.rules` already grants `get` on such a file through
        // `resourceIsOwnedByAuthOwnershipKey()`, so without this the direct document read succeeds while the
        // download callable returns FORBIDDEN. The calendar's published ICS is the case in point.
        rolesForStorageFileOwnershipKey: async (ownershipKey) => {
          const ownerKey = uid == null ? undefined : firestoreModelKey(profileIdentity, uid);
          const isOwner = ownerKey != null && ownershipKey === ownerKey;

          // A file in a guestbook's SHARED FormSpace inherits that space's `o` — the guestbook's key — and
          // its `u` is the album's owner, so neither the `u` branch nor the profile check above matches for
          // the signer who uploaded it. Without this, a signer sees the file listed on the space's `f` and
          // then cannot download it.
          const isGuestbookSigner = isOwner ? false : await isGuestbookOwnershipKeySignedByUser({ collections: context.app, ownershipKey, uid });
          const reachesSpace = isOwner || isGuestbookSigner;

          return reachesSpace && (await formSpaceFileAccessAllows()) ? { read: true, download: true } : undefined;
        }
      })
    ); // system admin only
  },
  getFirestoreCollection: (c) => c.app.storageFileCollection
});

/**
 * @dbxModelServiceFactory storageFileGroup
 */
export const storageFileGroupFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, StorageFileGroup, StorageFileGroupDocument, StorageFileGroupRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<StorageFileGroup, StorageFileGroupDocument>, context: DemoFirebaseContext, _model: StorageFileGroupDocument): PromiseOrValue<GrantedRoleMap<StorageFileGroupRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.storageFileGroupCollection
});

// MARK: Calendar
/**
 * @dbxModelServiceFactory calendar
 */
export const calendarFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, Calendar, CalendarDocument, CalendarRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<Calendar, CalendarDocument>, context: DemoFirebaseContext, _model: CalendarDocument): PromiseOrValue<GrantedRoleMap<CalendarRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap(), () => {
      // a calendar is readable by whoever owns it, mirroring `resourceIsOwnedByAuthOwnershipKey()` in
      // firestore.rules, and rotatable by them too: the published .ics url is a bearer credential this
      // calendar minted, so its own `o` is the authoritative answer to who may revoke it.
      //
      // Generic `update` is granted to nobody. Arbitrary client writes would bypass the `s: true` invariant
      // the publish sweep's correctness rests on, which is also why firestore.rules denies them by omission.
      // A calendar with no `o` has no owner to grant to, leaving it sys-admin only.
      const uid = context.auth?.uid;
      const ownerKey = uid == null ? undefined : firestoreModelKey(profileIdentity, uid);
      const isOwner = ownerKey != null && output.data?.o === ownerKey;

      return grantedRoleKeysMapFromArray<CalendarRoles>(isOwner ? ['read', 'rotate'] : []);
    });
  },
  getFirestoreCollection: (c) => c.app.calendarCollection
});

// MARK: FormSpace
/**
 * @dbxModelServiceFactory formSpace
 */
export const formSpaceFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, FormSpace, FormSpaceDocument, FormSpaceRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<FormSpace, FormSpaceDocument>, context: DemoFirebaseContext, model: FormSpaceDocument): PromiseOrValue<GrantedRoleMap<FormSpaceRoles>> {
    const grantFormSpaceRolesForUser = grantFormSpaceRolesForUserAuthFunction({ output, context, model });
    return grantModelRolesIfAdmin(
      context,
      fullAccessRoleMap(),
      grantFormSpaceRolesForUser({
        // the owner drives their own form end to end: read it, edit the draft, upload into it, take a file
        // back out, submit it, and abandon it. Nothing here grants access to anyone else's space.
        //
        // `removeFile` only opens the door — WHICH files it reaches is the type's `fileAccess`, and on the
        // guestbook album that narrows even this branch to the owner's own uploads.
        //
        // `reopen` and `lock` are granted unconditionally too, and are not a contradiction of `submit`
        // being the one-way door: WHETHER a space may be reopened at all is the type's own policy, checked
        // inside the action's transaction, and only `demo_test` declares one. A role map cannot answer that
        // question anyway — it has no clock and no type registry — so what it grants is permission to ask.
        rolesForFormSpaceUser: async () => ({ read: true, update: true, uploadFile: true, removeFile: true, submit: true, reopen: true, lock: true, delete: true }),
        // A SHARED space: `o` names a Guestbook rather than a Profile, and anyone who has left an entry on
        // that guestbook may read it, upload into it, and take their OWN uploads back out.
        //
        // `removeFile` is safe to grant to every signer precisely because it is not `update`: the per-file
        // gate behind it is the type's `fileAccess`, which this album sets to 'uploader', so the role
        // reaches a signer's own photos and nobody else's.
        //
        // `update`, `submit`, `reopen`, `lock` and `delete` are deliberately withheld. They are one-way
        // doors over everyone else's files, and the branch above already grants them to the space's `u` —
        // which for a shared space is the guestbook's creator, not whoever happened to open the album
        // first. `reopen` and `lock` belong in that list for a sharper reason than the rest: on a shared
        // space they would let any one signer reopen — or finalize — a submission made on behalf of
        // everybody who contributed to it.
        //
        // A GuestbookEntry's document id IS its author's uid, so "did this caller sign?" is one existence
        // check on a path built from the space's own ownership key — no query, and no membership list to
        // keep in step. `firestore.rules` asks the identical question, which is what stops a direct
        // document read and a callable from disagreeing about who is a member.
        rolesForFormSpaceOwnershipKey: async (ownershipKey) => {
          const signed = await isGuestbookOwnershipKeySignedByUser({ collections: context.app, ownershipKey, uid: context.auth?.uid });
          return signed ? grantedRoleKeysMapFromArray<FormSpaceRoles>(['read', 'uploadFile', 'removeFile']) : undefined;
        }
      })
    );
  },
  getFirestoreCollection: (c) => c.app.formSpaceCollection
});

/**
 * @dbxModelServiceFactory oidcEntry
 */
export const oidcEntryFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, OidcEntry, OidcEntryDocument, OidcEntryRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<OidcEntry, OidcEntryDocument>, context: DemoFirebaseContext, _model: OidcEntryDocument): PromiseOrValue<GrantedRoleMap<OidcEntryRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap(), async () => {
      const data = output.data;
      const uid = context.auth?.uid;
      const ownerKey = uid == null ? undefined : firestoreModelKey(profileIdentity, uid);

      // Client entries: full access for the owner (uses ownership key `o`).
      const isClientOwner = ownerKey != null && data?.o === ownerKey;
      // Grant entries: full access for the user the grant was issued to (uses `uid`).
      // Other token types (AccessToken / RefreshToken / Session / ...) are intentionally
      // not exposed at the model layer — they cascade through grant revocation instead.
      const isGrantOwner = uid != null && data?.type === 'Grant' && data?.uid === uid;

      let roleMap: GrantedRoleMap<OidcEntryRoles>;

      if (isClientOwner) {
        roleMap = fullAccessRoleMap();
      } else if (isGrantOwner) {
        roleMap = fullAccessRoleMap();
      } else {
        roleMap = noAccessRoleMap();
      }

      return roleMap;
    });
  },
  getFirestoreCollection: (c) => c.app.oidcEntryCollection
});

// MARK: OpenRouter
/**
 * @dbxModelServiceFactory openRouterPrompt
 */
export const openRouterPromptFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, OpenRouterPrompt, OpenRouterPromptDocument, OpenRouterPromptRoles>({
  // SERVER-ONLY: firestore.rules has no match block for `orp`, so no client can read it there.
  // Without this flag the model API — which authorizes via roleMapForModel under the Admin SDK and
  // never consults the rules — would hand the document to a client anyway.
  serverOnly: true,
  roleMapForModel: function (output: FirebasePermissionServiceModel<OpenRouterPrompt, OpenRouterPromptDocument>, context: DemoFirebaseContext, _model: OpenRouterPromptDocument): PromiseOrValue<GrantedRoleMap<OpenRouterPromptRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only — a prompt is operational configuration
  },
  getFirestoreCollection: (c) => c.app.openRouterPromptCollection
});

/**
 * @dbxModelServiceFactory openRouterPromptVersion
 */
export const openRouterPromptVersionFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, OpenRouterPromptVersion, OpenRouterPromptVersionDocument, OpenRouterPromptVersionRoles>({
  // SERVER-ONLY: firestore.rules has no match block for `orpv`, so no client can read it there.
  // Without this flag the model API — which authorizes via roleMapForModel under the Admin SDK and
  // never consults the rules — would hand the document to a client anyway.
  serverOnly: true,
  roleMapForModel: function (output: FirebasePermissionServiceModel<OpenRouterPromptVersion, OpenRouterPromptVersionDocument>, context: DemoFirebaseContext, _model: OpenRouterPromptVersionDocument): PromiseOrValue<GrantedRoleMap<OpenRouterPromptVersionRoles>> {
    return grantModelRolesIfAdmin(context, fullAccessRoleMap()); // system admin only
  },
  getFirestoreCollection: (c) => c.app.openRouterPromptVersionCollectionGroup
});

// MARK: UserExternalConnection
/**
 * @dbxModelServiceFactory userExternalConnection
 */
export const userExternalConnectionFirebaseModelServiceFactory = firebaseModelServiceFactory<DemoFirebaseContext, UserExternalConnection, UserExternalConnectionDocument, UserExternalConnectionRoles>({
  roleMapForModel: function (output: FirebasePermissionServiceModel<UserExternalConnection, UserExternalConnectionDocument>, context: DemoFirebaseContext, model: UserExternalConnectionDocument): PromiseOrValue<GrantedRoleMap<UserExternalConnectionRoles>> {
    return grantFullAccessIfAuthUserRelated({ context, document: model });
  },
  getFirestoreCollection: (c) => c.app.userExternalConnectionCollection
});

// MARK: Services
export type DemoFirebaseModelTypes = SystemStateTypes | GuestbookTypes | ProfileTypes | NotificationTypes | StorageFileTypes | CalendarTypes | FormSpaceTypes | OidcModelTypes | UserExternalConnectionTypes | OpenRouterPromptTypes;

export type DemoFirebaseContextAppContext = DemoFirestoreCollections;

export type DemoFirebaseBaseContext = FirebaseAppModelContext<DemoFirebaseContextAppContext>;

export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
  systemState: systemStateFirebaseModelServiceFactory,
  guestbook: guestbookFirebaseModelServiceFactory,
  guestbookEntry: guestbookEntryFirebaseModelServiceFactory,
  profile: profileFirebaseModelServiceFactory,
  profilePrivate: profilePrivateFirebaseModelServiceFactory,
  notificationUser: notificationUserFirebaseModelServiceFactory,
  notificationSummary: notificationSummaryFirebaseModelServiceFactory,
  notificationBox: notificationBoxFirebaseModelServiceFactory,
  notification: notificationFirebaseModelServiceFactory,
  notificationWeek: notificationWeekFirebaseModelServiceFactory,
  notificationLoggedEventDay: notificationLoggedEventDayFirebaseModelServiceFactory,
  notificationLoggedEventDayPage: notificationLoggedEventDayPageFirebaseModelServiceFactory,
  storageFile: storageFileFirebaseModelServiceFactory,
  storageFileGroup: storageFileGroupFirebaseModelServiceFactory,
  calendar: calendarFirebaseModelServiceFactory,
  formSpace: formSpaceFirebaseModelServiceFactory,
  oidcEntry: oidcEntryFirebaseModelServiceFactory,
  userExternalConnection: userExternalConnectionFirebaseModelServiceFactory,
  openRouterPrompt: openRouterPromptFirebaseModelServiceFactory,
  openRouterPromptVersion: openRouterPromptVersionFirebaseModelServiceFactory
};

export type DemoFirebaseModelServiceFactories = typeof DEMO_FIREBASE_MODEL_SERVICE_FACTORIES;

export const demoFirebaseModelServices = firebaseModelsService<DemoFirebaseModelServiceFactories, DemoFirebaseBaseContext, DemoFirebaseModelTypes>(DEMO_FIREBASE_MODEL_SERVICE_FACTORIES);

export type DemoFirebaseContext = DemoFirebaseBaseContext & { service: DemoFirebaseModelServiceFactories };

// MARK: System
/**
 * Loads the example system state document by its well-known type identifier.
 *
 * @param accessor - The document accessor used to load SystemState documents.
 * @returns The SystemStateDocument typed with ExampleSystemData.
 */
export function loadExampleSystemState(accessor: FirestoreDocumentAccessor<SystemState<SystemStateStoredData>, SystemStateDocument<SystemStateStoredData>>): SystemStateDocument<ExampleSystemData> {
  return accessor.loadDocumentForId(EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE) as SystemStateDocument<ExampleSystemData>;
}
