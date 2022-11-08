import { systemStateExampleRead } from './../system/systemstate.read';
import { createGuestbook } from './../guestbook/guestbook.crud';
import { updateProfile, updateProfileUsername, updateProfleOnboarding } from '../profile/profile.update';
import { updateGuestbookEntry } from '../guestbook/guestbookentry.update';
import { inAuthContext, onCallCreateModel, onCallDeleteModel, onCallUpdateModel, onCallSpecifierHandler, onCallReadModel } from '@dereekb/firebase-server';
import { DemoOnCallCreateModelMap, DemoOnCallDeleteModelMap, DemoOnCallReadModelMap, DemoOnCallUpdateModelMap, onCallWithDemoNestContext } from '../function';

// MARK: Create
export const demoCreateModelMap: DemoOnCallCreateModelMap = {
  guestbook: createGuestbook
};
export const demoCreateModel = onCallWithDemoNestContext(inAuthContext(onCallCreateModel(demoCreateModelMap)));

// MARK: Read
export const demoReadModelMap: DemoOnCallReadModelMap = {
  systemState: onCallSpecifierHandler({
    exampleread: systemStateExampleRead
  })
};
export const demoReadModel = onCallWithDemoNestContext(inAuthContext(onCallReadModel(demoReadModelMap)));

// MARK: Update
export const demoUpdateModelMap: DemoOnCallUpdateModelMap = {
  guestbookEntry: updateGuestbookEntry,
  profile: onCallSpecifierHandler({
    _: updateProfile,
    username: updateProfileUsername,
    onboard: updateProfleOnboarding
  })
};
export const demoUpdateModel = onCallWithDemoNestContext(inAuthContext(onCallUpdateModel(demoUpdateModelMap)));

// MARK: Delete
export const demoDeleteModelMap: DemoOnCallDeleteModelMap = {};
export const demoDeleteModel = onCallWithDemoNestContext(inAuthContext(onCallDeleteModel(demoDeleteModelMap)));
