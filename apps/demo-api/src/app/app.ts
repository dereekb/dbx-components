import { guestbookEntryUpdateKey, profileSetUsernameKey } from '@dereekb/demo-firebase';
import { NestAppPromiseGetter, nestServerInstance } from '@dereekb/firebase-server';
import { DemoApiAppModule } from './app.module';
import { profileSetUsername, initUserOnCreate } from './function';
import { guestbookEntryUpdateEntry } from './function/guestbook';

export const {
  initNestServer
} = nestServerInstance({ moduleClass: DemoApiAppModule });

/**
 * Builder for all functions in the app.
 * 
 * @param server 
 * @returns 
 */
export function demoAppFunctions(nest: NestAppPromiseGetter) {
  return {
    // Events
    // Auth
    initUserOnCreate: initUserOnCreate(nest),
    // ---
    // API Calls
    // Profile
    [profileSetUsernameKey]: profileSetUsername(nest),
    // Guestbook
    [guestbookEntryUpdateKey]: guestbookEntryUpdateEntry(nest)
  };
}
