import { APP_CODE_PREFIX_CAMELCallModel } from './function/model/crud.functions';
import { exampleSetUsernameKey } from 'FIREBASE_COMPONENTS_NAME';
import { type NestAppPromiseGetter, type NestServerInstanceConfig, nestServerInstance } from '@dereekb/firebase-server';
import { CALL_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase';
import { APP_CODE_PREFIXApiAppModule } from './app.module';
import { exampleSetUsername } from './function';
import { APP_CODE_PREFIX_CAMELExampleUsageOfSchedule } from './function/model/schedule.functions';
// @dbx-addon:oidc:api-app:imports
// @dbx-addon:mcp:api-app:imports

export const APP_CODE_PREFIX_CAMELNestServerConfig: NestServerInstanceConfig<APP_CODE_PREFIXApiAppModule> = {
  moduleClass: APP_CODE_PREFIXApiAppModule,
  configureWebhooks: true,
  // @dbx-addon:oidc:api-app:config
  globalApiRoutePrefix: {
    globalApiRoutePrefix: '/api', // app needs to respond to all requests prefixed with '/api'
    exclude: [
      // @dbx-addon:oidc:api-app:route-exclude
      // @dbx-addon:mcp:api-app:route-exclude
    ]
  }
};

export const { initNestServer } = nestServerInstance(APP_CODE_PREFIX_CAMELNestServerConfig);

export function allAppFunctions(nest: NestAppPromiseGetter) {
  return {
    // Events
    // ---
    // Auth
    // Model
    [CALL_MODEL_APP_FUNCTION_KEY]: APP_CODE_PREFIX_CAMELCallModel(nest),
    // API Calls
    // Example
    [exampleSetUsernameKey]: exampleSetUsername(nest)
  };
}

export function allScheduledAppFunctions(nest: NestAppPromiseGetter) {
  return {
    // Scheduled Functions
    exampleSchedule: APP_CODE_PREFIX_CAMELExampleUsageOfSchedule(nest)
  };
}
