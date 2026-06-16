import { type FirebaseFunctionGetter, type FirebaseFunctionsConfigMap, type FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY, lazyFirebaseFunctionsFactory, storageFileFunctionMap, StorageFileFunctions, type StorageFileFunctionTypeMap } from '@dereekb/firebase';
import { type Functions } from 'firebase/functions';
import { type ExampleFunctionTypeMap, exampleFunctionMap, ExampleFunctions } from './model';
import { APP_CODE_PREFIXDevelopmentFunctionMap, APP_CODE_PREFIXDevelopmentFunctions, type APP_CODE_PREFIXDevelopmentFunctionTypeMap } from './development';
// @dbx-addon:oidc:fb-functions:imports

export type APP_CODE_PREFIXFirebaseFunctionsMap = {
  readonly exampleFunctions: ExampleFunctionTypeMap;
  // readonly notificationFunctions: NotificationFunctionTypeMap;   // TODO: Add if enabling notification functions. Must add corresponding calls to crud.functions.ts
  readonly storageFileFunctions: StorageFileFunctionTypeMap;
  // @dbx-addon:oidc:fb-functions:typemap
  readonly [FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY]: APP_CODE_PREFIXDevelopmentFunctionTypeMap;
};

export const APP_CODE_PREFIX_CAPS_FIREBASE_FUNCTIONS_CONFIG: FirebaseFunctionsConfigMap<APP_CODE_PREFIXFirebaseFunctionsMap> = {
  exampleFunctions: [ExampleFunctions, exampleFunctionMap],
  storageFileFunctions: [StorageFileFunctions, storageFileFunctionMap],
  // @dbx-addon:oidc:fb-functions:configmap
  developmentFunctions: [APP_CODE_PREFIXDevelopmentFunctions, APP_CODE_PREFIXDevelopmentFunctionMap]
};

export abstract class APP_CODE_PREFIXFirebaseFunctionsGetter {
  abstract readonly exampleFunctions: FirebaseFunctionGetter<ExampleFunctions>;
  abstract readonly storageFileFunctions: FirebaseFunctionGetter<StorageFileFunctions>;
  // @dbx-addon:oidc:fb-functions:getter
  abstract readonly developmentFunctions: FirebaseFunctionGetter<APP_CODE_PREFIXDevelopmentFunctions>;
}

export function makeAPP_CODE_PREFIXFirebaseFunctions(functions: Functions): APP_CODE_PREFIXFirebaseFunctionsGetter {
  const factory = lazyFirebaseFunctionsFactory<APP_CODE_PREFIXFirebaseFunctionsMap>(APP_CODE_PREFIX_CAPS_FIREBASE_FUNCTIONS_CONFIG);
  return factory(functions) as APP_CODE_PREFIXFirebaseFunctionsGetter;
}
