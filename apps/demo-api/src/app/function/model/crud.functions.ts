import { updateProfile } from '../profile/profile.update';
import { updateGuestbookEntry } from '../guestbook/guestbookentry.update';
import { inAuthContext, onCallDeleteModel, onCallUpdateModel } from '@dereekb/firebase-server';
import { DemoOnCallDeleteModelMap, DemoOnCallUpdateModelMap, onCallWithDemoNestContext } from '../function';

// MARK: Update
export const demoUpdateModelMap: DemoOnCallUpdateModelMap = {
  guestbookEntry: updateGuestbookEntry,
  profile: updateProfile
};
export const demoUpdateModel = onCallWithDemoNestContext(inAuthContext(onCallUpdateModel(demoUpdateModelMap)));

// MARK: Delete
export const demoDeleteModelMap: DemoOnCallDeleteModelMap = {};
export const demoDeleteModel = onCallWithDemoNestContext(inAuthContext(onCallDeleteModel(demoDeleteModelMap)));
