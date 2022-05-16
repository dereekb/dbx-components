import { updateProfileKey, updateGuestbookEntryKey, profileSetUsernameKey } from '@dereekb/demo-firebase';
import { NestAppPromiseGetter, nestServerInstance } from '@dereekb/firebase-server';
import { DemoApiAppModule } from './app.module';
import { profileSetUsername, initUserOnCreate } from './function';
import { updateGuestbookEntry } from './function/guestbook';
import { updateProfile } from './function/profile/profile.update';

export const {
  initNestServer
} = nestServerInstance({ moduleClass: DemoApiAppModule });

/**
 * Builder for all functions in the app.
 * 
 * @param server 
 * @returns 
 */
export function allAppFunctions(nest: NestAppPromiseGetter) {
  return {
    // Events
    // Auth
    initUserOnCreate: initUserOnCreate(nest),
    // ---
    // API Calls
    // Profile
    [profileSetUsernameKey]: profileSetUsername(nest),
    [updateProfileKey]: updateProfile(nest),
    // Guestbook
    [updateGuestbookEntryKey]: updateGuestbookEntry(nest)
  };
}
