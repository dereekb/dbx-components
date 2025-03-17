import { systemStateExampleRead } from './../system/systemstate.read';
import { createGuestbook } from './../guestbook/guestbook.crud';
import { updateProfile, updateProfileCreateTestNotification, updateProfileUsername, updateProfleOnboarding } from '../profile/profile.update';
import { insertGuestbookEntry } from '../guestbook/guestbookentry.update';
import { inAuthContext, onCallCreateModel, onCallDeleteModel, onCallUpdateModel, onCallSpecifierHandler, onCallReadModel, onCallModel, OnCallModelMap } from '@dereekb/firebase-server';
import { DemoOnCallCreateModelMap, DemoOnCallDeleteModelMap, DemoOnCallReadModelMap, DemoOnCallUpdateModelMap, onCallWithDemoNestContext } from '../function';
import { updateNotificationUser, resyncNotificationUser } from '../notification/notificationuser.update';
import { updateNotificationBox, updateNotificationBoxRecipient } from '../notification/notificationbox.update';
import { guestbookSubscribeToNotifications } from '../guestbook/guestbook.update';

// MARK: Create
export const demoCreateModelMap: DemoOnCallCreateModelMap = {
  guestbook: createGuestbook
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

export const demoCallModel = onCallWithDemoNestContext(inAuthContext(onCallModel(demoCallModelMap)));
