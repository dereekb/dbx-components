import { systemStateExampleread } from './../system/systemstate.read';
import { guestbookCreate } from '../guestbook/guestbook.create';
import { profileUpdate, profileUpdateCreateTestNotification, profileUpdateResetPassword, profileUpdateUsername, profileUpdateOnboard } from '../profile/profile.update';
import { guestbookEntryInsert, guestbookEntryLike } from '../guestbook/guestbookentry.update';
import { guestbookEntryDelete } from '../guestbook/guestbookentry.delete';
import { onCallCreateModel, onCallDeleteModel, onCallUpdateModel, onCallQueryModel, onCallSpecifierHandler, onCallReadModel, onCallModel, type OnCallModelMap } from '@dereekb/firebase-server';
import { oidcCallModelScopePreAssert } from '@dereekb/firebase-server/oidc';
import { type DemoOnCallCreateModelMap, type DemoOnCallDeleteModelMap, type DemoOnCallReadModelMap, type DemoOnCallUpdateModelMap, type DemoOnCallQueryModelMap, onCallWithDemoNestContext } from '../function.context';
import { notificationUserUpdate, notificationUserResync } from '../notification/notificationuser.update';
import { notificationBoxUpdate, notificationBoxRecipient } from '../notification/notificationbox.update';
import { notificationSummaryUpdate } from '../notification/notificationsummary.update';
import { guestbookSubscribeToNotifications } from '../guestbook/guestbook.update';
import { profileCreate } from '../profile/profile.create';
import { profileDelete } from '../profile/profile.delete';
import { notificationCreate } from '../notification/notification.create';
import { notificationSend } from '../notification/notification.update';
import { storageFileUpdate, storageFileProcess, storageFileSyncWithGroups } from '../storagefile/storagefile.update';
import { storageFileCreate, storageFileFromUpload, storageFileAllFromUpload } from '../storagefile/storagefile.create';
import { storageFileDelete } from '../storagefile/storagefile.delete';
import { storageFileDownload, storageFileDownloadMultiple } from '../storagefile/storagefile.read';
import { storageFileGroupRegenerateContent, storageFileGroupUpdate } from '../storagefile/storagefilegroup.update';
import { profileDownloadArchive } from '../profile/profile.read';
import { oidcEntryCreateClient } from '../oidc/oidcclient.create';
import { oidcEntryUpdateClient, oidcEntryRotateClientSecret } from '../oidc/oidcclient.update';
import { oidcEntryDeleteClient } from '../oidc/oidcclient.delete';
import { oidcEntryDeleteToken } from '../oidc/oidcentry.delete';
import { guestbookQuery } from '../guestbook/guestbook.query';
import { guestbookEntryQuery } from '../guestbook/guestbookentry.query';

// MARK: Create
export const demoCreateModelMap: DemoOnCallCreateModelMap = {
  guestbook: guestbookCreate,
  //
  // Without Auth Examples
  // These are just to show how to create functions that do not assert auth.
  profile: profileCreate,
  notification: onCallSpecifierHandler({
    _: notificationCreate
  }),
  storageFile: onCallSpecifierHandler({
    _: storageFileCreate,
    fromUpload: storageFileFromUpload,
    allFromUpload: storageFileAllFromUpload
  }),
  oidcEntry: onCallSpecifierHandler({
    client: oidcEntryCreateClient
  })
};

// MARK: Read
export const demoReadModelMap: DemoOnCallReadModelMap = {
  systemState: onCallSpecifierHandler({
    exampleread: systemStateExampleread
  }),
  storageFile: onCallSpecifierHandler({
    download: storageFileDownload,
    downloadMultiple: storageFileDownloadMultiple
  }),
  profile: onCallSpecifierHandler({
    downloadArchive: profileDownloadArchive
  })
};

// MARK: Update
export const demoUpdateModelMap: DemoOnCallUpdateModelMap = {
  guestbook: onCallSpecifierHandler({
    subscribeToNotifications: guestbookSubscribeToNotifications
  }),
  guestbookEntry: onCallSpecifierHandler({
    insert: guestbookEntryInsert,
    like: guestbookEntryLike
  }),
  profile: onCallSpecifierHandler({
    _: profileUpdate,
    username: profileUpdateUsername,
    onboard: profileUpdateOnboard,
    createTestNotification: profileUpdateCreateTestNotification,
    resetPassword: profileUpdateResetPassword
  }),
  notificationUser: onCallSpecifierHandler({
    _: notificationUserUpdate,
    resync: notificationUserResync
  }),
  notificationBox: onCallSpecifierHandler({
    _: notificationBoxUpdate,
    recipient: notificationBoxRecipient
  }),
  notificationSummary: onCallSpecifierHandler({
    _: notificationSummaryUpdate
  }),
  notification: onCallSpecifierHandler({
    send: notificationSend
  }),
  storageFile: onCallSpecifierHandler({
    _: storageFileUpdate,
    process: storageFileProcess,
    syncWithGroups: storageFileSyncWithGroups
  }),
  storageFileGroup: onCallSpecifierHandler({
    _: storageFileGroupUpdate,
    regenerateContent: storageFileGroupRegenerateContent
  }),
  oidcEntry: onCallSpecifierHandler({
    client: oidcEntryUpdateClient,
    rotateClientSecret: oidcEntryRotateClientSecret
  })
};

// MARK: Delete
export const demoDeleteModelMap: DemoOnCallDeleteModelMap = {
  guestbookEntry: guestbookEntryDelete,
  profile: profileDelete,
  storageFile: onCallSpecifierHandler({
    _: storageFileDelete
  }),
  oidcEntry: onCallSpecifierHandler({
    client: oidcEntryDeleteClient,
    token: oidcEntryDeleteToken
  })
};

// MARK: Query
export const demoQueryModelMap: DemoOnCallQueryModelMap = {
  guestbook: guestbookQuery,
  guestbookEntry: guestbookEntryQuery
};

// MARK: Call
export const demoCallModelMap: OnCallModelMap = {
  create: onCallCreateModel(demoCreateModelMap),
  read: onCallReadModel(demoReadModelMap),
  update: onCallUpdateModel(demoUpdateModelMap),
  delete: onCallDeleteModel(demoDeleteModelMap),
  query: onCallQueryModel(demoQueryModelMap)
};

/**
 * The raw onCallModel dispatch function with _apiDetails attached.
 *
 * Used by the Model API and MCP controllers to dispatch requests
 * and introspect the handler metadata tree.
 *
 * Wires {@link oidcCallModelScopePreAssert} so that callers authenticated via
 * an OIDC bearer token must hold the matching `model.<call>` scope.
 */
export const demoCallModelFn = onCallModel(demoCallModelMap, {
  preAssert: oidcCallModelScopePreAssert()
});

export const demoCallModel = onCallWithDemoNestContext(demoCallModelFn);
