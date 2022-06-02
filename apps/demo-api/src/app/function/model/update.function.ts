import { updateProfile } from './../profile/profile.update';
import { updateGuestbookEntry } from './../guestbook/guestbookentry.update';
import { inAuthContext, onCallUpdateModel } from '@dereekb/firebase-server';
import { DemoOnCallUpdateModelMap, onCallWithDemoNestContext } from '../function';

export const demoUpdateModelMap: DemoOnCallUpdateModelMap = {
  guestbookEntry: updateGuestbookEntry,
  profile: updateProfile
};

export const demoUpdateModel = onCallWithDemoNestContext(inAuthContext(onCallUpdateModel(demoUpdateModelMap)));
