import { demoCallModel } from './function/model/crud.functions';
import { profileSetUsernameKey } from 'demo-firebase';
import { type NestAppPromiseGetter, nestServerInstance } from '@dereekb/firebase-server';
import { CALL_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase';
import { DemoApiAppModule } from './app.module';
import { profileSetUsername, initUserOnCreate } from './function';
import { demoExampleUsageOfSchedule } from './function/model/schedule.functions';

export const DEMO_API_NEST_SERVER_CONFIG = {
  moduleClass: DemoApiAppModule,
  configureWebhooks: true,
  globalApiRoutePrefix: {
    globalApiRoutePrefix: '/api',
    exclude: ['.well-known/(.*)', 'oidc/(.*)', 'interaction/(.*)']
  }
};

export const { initNestServer } = nestServerInstance(DEMO_API_NEST_SERVER_CONFIG);

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
    [CALL_MODEL_APP_FUNCTION_KEY]: demoCallModel(nest),
    // ---
    // API Calls
    // Profile
    [profileSetUsernameKey]: profileSetUsername(nest)
    // Guestbook
  };
}

/**
 * Builder for all scheduled functions in the app.
 *
 * @param nest
 */
export function allScheduledAppFunctions(nest: NestAppPromiseGetter) {
  return {
    // Scheduled Functions
    exampleSchedule: demoExampleUsageOfSchedule(nest)
  };
}
