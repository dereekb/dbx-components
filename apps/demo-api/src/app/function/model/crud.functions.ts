import { systemStateExampleRead } from './../system/systemstate.read';
import { createGuestbook } from '../guestbook/guestbook.create';
import { profileUpdate, profileUpdateCreateTestNotification, profileUpdateUsername, profileUpdateOnboarding } from '../profile/profile.update';
import { insertGuestbookEntry } from '../guestbook/guestbookentry.update';
import { onCallCreateModel, onCallDeleteModel, onCallUpdateModel, onCallSpecifierHandler, onCallReadModel, onCallModel, type OnCallModelMap } from '@dereekb/firebase-server';
import { type DemoOnCallCreateModelMap, type DemoOnCallDeleteModelMap, type DemoOnCallReadModelMap, type DemoOnCallUpdateModelMap, onCallWithDemoNestContext } from '../function.context';
import { updateNotificationUser, resyncNotificationUser } from '../notification/notificationuser.update';
import { updateNotificationBox, updateNotificationBoxRecipient } from '../notification/notificationbox.update';
import { guestbookSubscribeToNotifications } from '../guestbook/guestbook.update';
import { profileCreate } from '../profile/profile.create';
import { createNotification } from '../notification/notification.create';
import { notificationSend } from '../notification/notification.update';
import { storageFileUpdate, storageFileProcess, storageFileSyncWithGroups } from '../storagefile/storagefile.update';
import { storageFileCreate, storageFileInitializeFromUpload, storageFileInitializeAllFromUploads } from '../storagefile/storagefile.create';
import { storageFileDownload, storageFileDownloadMultiple } from '../storagefile/storagefile.read';
import { storageFileGroupRegenerateContent, storageFileGroupUpdate } from '../storagefile/storagefilegroup.update';
import { profileDownloadArchive } from '../profile/profile.read';
import { createOidcClient } from '../oidc/oidcclient.create';
import { updateOidcClient, rotateOidcClientSecret } from '../oidc/oidcclient.update';
import { deleteOidcClient } from '../oidc/oidcclient.delete';

// MARK: Create
export const demoCreateModelMap: DemoOnCallCreateModelMap = {
  guestbook: createGuestbook,
  //
  // Without Auth Examples
  // These are just to show how to create functions that do not assert auth.
  profile: profileCreate,
  notification: onCallSpecifierHandler({
    _: createNotification
  }),
  storageFile: onCallSpecifierHandler({
    _: storageFileCreate,
    fromUpload: storageFileInitializeFromUpload,
    allFromUpload: storageFileInitializeAllFromUploads
  }),
  oidcEntry: onCallSpecifierHandler({
    client: createOidcClient
  })
};

// MARK: Read
export const demoReadModelMap: DemoOnCallReadModelMap = {
  systemState: onCallSpecifierHandler({
    exampleread: systemStateExampleRead
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
  guestbookEntry: insertGuestbookEntry,
  profile: onCallSpecifierHandler({
    _: profileUpdate,
    username: profileUpdateUsername,
    onboard: profileUpdateOnboarding,
    createTestNotification: profileUpdateCreateTestNotification
  }),
  notificationUser: onCallSpecifierHandler({
    _: updateNotificationUser,
    resync: resyncNotificationUser
  }),
  notificationBox: onCallSpecifierHandler({
    _: updateNotificationBox,
    recipient: updateNotificationBoxRecipient
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
    client: updateOidcClient,
    rotateClientSecret: rotateOidcClientSecret
  })
};

// MARK: Delete
export const demoDeleteModelMap: DemoOnCallDeleteModelMap = {
  oidcEntry: onCallSpecifierHandler({
    client: deleteOidcClient
  })
};

// MARK: Call
export const demoCallModelMap: OnCallModelMap = {
  create: onCallCreateModel(demoCreateModelMap),
  read: onCallReadModel(demoReadModelMap),
  update: onCallUpdateModel(demoUpdateModelMap),
  delete: onCallDeleteModel(demoDeleteModelMap)
};

/**
 * The raw onCallModel dispatch function with _apiDetails attached.
 *
 * Used by the Model API and MCP controllers to dispatch requests
 * and introspect the handler metadata tree.
 */
export const demoCallModelFn = onCallModel(demoCallModelMap);

export const demoCallModel = onCallWithDemoNestContext(demoCallModelFn);
