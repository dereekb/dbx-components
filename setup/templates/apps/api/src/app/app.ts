import { APP_CODE_PREFIX_LOWERCreateModel, APP_CODE_PREFIX_LOWERUpdateModel, APP_CODE_PREFIX_LOWERDeleteModel } from './function/model/crud.functions';
import { exampleSetUsernameKey } from 'FIREBASE_COMPONENTS_NAME';
import { NestAppPromiseGetter, nestServerInstance } from '@dereekb/firebase-server';
import { CREATE_MODEL_APP_FUNCTION_KEY, UPDATE_MODEL_APP_FUNCTION_KEY, DELETE_MODEL_APP_FUNCTION_KEY } from '@dereekb/firebase';
import { APP_CODE_PREFIXApiAppModule } from './app.module';
import { exampleSetUsername } from './function';

export const {
  initNestServer
} = nestServerInstance({ moduleClass: APP_CODE_PREFIXApiAppModule });

export function allAppFunctions(nest: NestAppPromiseGetter) {
  return {
    // Events
    // ---
    // Auth
    // Model
    [CREATE_MODEL_APP_FUNCTION_KEY]: APP_CODE_PREFIX_LOWERCreateModel(nest),
    [UPDATE_MODEL_APP_FUNCTION_KEY]: APP_CODE_PREFIX_LOWERUpdateModel(nest),
    [DELETE_MODEL_APP_FUNCTION_KEY]: APP_CODE_PREFIX_LOWERDeleteModel(nest),
    // API Calls
    // Example
    [exampleSetUsernameKey]: exampleSetUsername(nest)
  };
}
