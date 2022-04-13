import { NestAppPromiseGetter, NestServer, nestServerInstance } from '@dereekb/firebase-server';
import { DemoApiAppModule } from './app.module';
import { profileSetUsername, initUserOnCreate } from './function';

export const {
  initNestServer
} = nestServerInstance(DemoApiAppModule);

/**
 * Builder for all functions in the app.
 * 
 * @param server 
 * @returns 
 */
export function demoAppFunctions(nest: NestAppPromiseGetter) {
  return {
    // Auth
    initUserOnCreate: initUserOnCreate(nest),
    // Profile
    profileSetUsername: profileSetUsername(nest)
  };
}
