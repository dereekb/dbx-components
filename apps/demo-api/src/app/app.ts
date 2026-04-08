import { demoCallModel } from './function/model/crud.functions';
import { profileSetUsernameKey } from 'demo-firebase';
import { type NestAppPromiseGetter, nestServerInstance, type NestServerInstanceConfig } from '@dereekb/firebase-server';
import { CALL_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase';
import { FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE, applyOidcAuthMiddleware } from '@dereekb/firebase-server/oidc';
import { DemoApiAppModule } from './app.module';
import { profileSetUsername, initUserOnCreate } from './function';
import { demoExampleUsageOfSchedule } from './function/model/schedule.functions';
import { type INestApplication } from '@nestjs/common';

export const DEMO_API_NEST_SERVER_CONFIG: NestServerInstanceConfig<DemoApiAppModule> = {
  moduleClass: DemoApiAppModule,
  modules: [],
  configureWebhooks: true,
  globalApiRoutePrefix: {
    globalApiRoutePrefix: '/api',
    exclude: [...FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE]
  },
  configureNestServerInstance: (nestApp: INestApplication) => {
    applyOidcAuthMiddleware(nestApp);
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
