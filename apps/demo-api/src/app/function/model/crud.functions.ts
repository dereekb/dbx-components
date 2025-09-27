import { systemStateExampleRead } from './../system/systemstate.read';
import { createGuestbook } from '../guestbook/guestbook.create';
import { updateProfile, updateProfileCreateTestNotification, updateProfileUsername, updateProfleOnboarding } from '../profile/profile.update';
import { insertGuestbookEntry } from '../guestbook/guestbookentry.update';
import { onCallCreateModel, onCallDeleteModel, onCallUpdateModel, onCallSpecifierHandler, onCallReadModel, onCallModel, OnCallModelMap } from '@dereekb/firebase-server';
import { DemoOnCallCreateModelMap, DemoOnCallDeleteModelMap, DemoOnCallReadModelMap, DemoOnCallUpdateModelMap, onCallWithDemoNestContext } from '../function';
import { updateNotificationUser, resyncNotificationUser } from '../notification/notificationuser.update';
import { updateNotificationBox, updateNotificationBoxRecipient } from '../notification/notificationbox.update';
import { guestbookSubscribeToNotifications } from '../guestbook/guestbook.update';
import { createProfile } from '../profile/profile.create';
import { createNotification } from '../notification/notification.create';
import { notificationSend } from '../notification/notification.update';

// MARK: Create
export const demoCreateModelMap: DemoOnCallCreateModelMap = {
  guestbook: createGuestbook,
  //
  // Without Auth Examples
  // These are just to show how to create functions that do not assert auth.
  profile: createProfile,
  notification: onCallSpecifierHandler({
    _: createNotification
  })
};

// MARK: Read
export const demoReadModelMap: DemoOnCallReadModelMap = {
  systemState: onCallSpecifierHandler({
    exampleread: systemStateExampleRead
  })
};

// MARK: Update
export const demoUpdateModelMap: DemoOnCallUpdateModelMap = {
  guestbook: onCallSpecifierHandler({
    subscribeToNotifications: guestbookSubscribeToNotifications
  }),
  guestbookEntry: insertGuestbookEntry,
  profile: onCallSpecifierHandler({
    _: updateProfile,
    username: updateProfileUsername,
    onboard: updateProfleOnboarding,
    createTestNotification: updateProfileCreateTestNotification
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
  })
};

// MARK: Delete
export const demoDeleteModelMap: DemoOnCallDeleteModelMap = {};

// MARK: Call
export const demoCallModelMap: OnCallModelMap = {
  create: onCallCreateModel(demoCreateModelMap),
  read: onCallReadModel(demoReadModelMap),
  update: onCallUpdateModel(demoUpdateModelMap),
  delete: onCallDeleteModel(demoDeleteModelMap)
};

export const demoCallModel = onCallWithDemoNestContext(onCallModel(demoCallModelMap));
