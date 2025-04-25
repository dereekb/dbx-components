import { APP_CODE_PREFIX_CAMELCallModel } from './function/model/crud.functions';
import { exampleSetUsernameKey } from 'FIREBASE_COMPONENTS_NAME';
import { NestAppPromiseGetter, nestServerInstance } from '@dereekb/firebase-server';
import { CALL_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase';
import { APP_CODE_PREFIXApiAppModule } from './app.module';
import { exampleSetUsername } from './function';
import { APP_CODE_PREFIX_CAMELExampleUsageOfSchedule } from './function/model/schedule.functions';

export const {
  initNestServer
} = nestServerInstance({ moduleClass: APP_CODE_PREFIXApiAppModule });

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
