import { demoUpdateModel } from './function/model/update.function';
import { profileSetUsernameKey } from '@dereekb/demo-firebase';
import { NestAppPromiseGetter, nestServerInstance, UPDATE_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase-server';
import { DemoApiAppModule } from './app.module';
import { profileSetUsername, initUserOnCreate } from './function';

export const { initNestServer } = nestServerInstance({
  moduleClass: DemoApiAppModule,
  configureWebhooks: true
});

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
    // Model
    [UPDATE_MODEL_APP_FUNCTION_KEY]: demoUpdateModel(nest),
    // ---
    // API Calls
    // Profile
    [profileSetUsernameKey]: profileSetUsername(nest)
    // Guestbook
  };
}
