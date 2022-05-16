import { exampleSetUsernameKey } from 'FIREBASE_COMPONENTS_NAME';
import { NestAppPromiseGetter, nestServerInstance } from '@dereekb/firebase-server';
import { APP_CODE_PREFIXApiAppModule } from './app.module';
import { exampleSetUsername } from './function';

export const {
  initNestServer
} = nestServerInstance({ moduleClass: APP_CODE_PREFIXApiAppModule });

export function allAppFunctions(nest: NestAppPromiseGetter) {
  return {
    // Events
    // ---
    // API Calls
    // Example
    [exampleSetUsernameKey]: exampleSetUsername(nest)
  };
}
