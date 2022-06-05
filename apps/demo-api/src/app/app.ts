import { demoCreateModel, demoDeleteModel, demoUpdateModel } from './function/model/crud.functions';
import { profileSetUsernameKey } from '@dereekb/demo-firebase';
import { NestAppPromiseGetter, nestServerInstance } from '@dereekb/firebase-server';
import { UPDATE_MODEL_APP_FUNCTION_KEY, DELETE_MODEL_APP_FUNCTION_KEY, CREATE_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase';
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
    [CREATE_MODEL_APP_FUNCTION_KEY]: demoCreateModel(nest),
    [UPDATE_MODEL_APP_FUNCTION_KEY]: demoUpdateModel(nest),
    [DELETE_MODEL_APP_FUNCTION_KEY]: demoDeleteModel(nest),
    // ---
    // API Calls
    // Profile
    [profileSetUsernameKey]: profileSetUsername(nest)
    // Guestbook
  };
}
