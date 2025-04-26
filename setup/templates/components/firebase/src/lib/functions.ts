import { FirebaseFunctionGetter, FirebaseFunctionsConfigMap, FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY, lazyFirebaseFunctionsFactory } from '@dereekb/firebase';
import { Functions } from 'firebase/functions';
import {ExampleFunctionTypeMap, exampleFunctionMap, ExampleFunctions } from './model';
import { APP_CODE_PREFIXDevelopmentFunctionMap, APP_CODE_PREFIXDevelopmentFunctions, APP_CODE_PREFIXDevelopmentFunctionTypeMap } from './development';

export type APP_CODE_PREFIXFirebaseFunctionsMap = {
  exampleFunctions: ExampleFunctionTypeMap;
  [FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY]: APP_CODE_PREFIXDevelopmentFunctionTypeMap;
}

export const APP_CODE_PREFIX_CAPS_FIREBASE_FUNCTIONS_CONFIG: FirebaseFunctionsConfigMap<APP_CODE_PREFIXFirebaseFunctionsMap> = {
  exampleFunctions: [ExampleFunctions, exampleFunctionMap],
  developmentFunctions: [APP_CODE_PREFIXDevelopmentFunctions, APP_CODE_PREFIXDevelopmentFunctionMap]
};

export abstract class APP_CODE_PREFIXFirebaseFunctionsGetter {
  abstract readonly exampleFunctions: FirebaseFunctionGetter<ExampleFunctions>;
  abstract readonly developmentFunctions: FirebaseFunctionGetter<APP_CODE_PREFIXDevelopmentFunctions>;
}

export function makeAPP_CODE_PREFIXFirebaseFunctions(functions: Functions): APP_CODE_PREFIXFirebaseFunctionsGetter {
  const factory = lazyFirebaseFunctionsFactory<APP_CODE_PREFIXFirebaseFunctionsMap>(APP_CODE_PREFIX_CAPS_FIREBASE_FUNCTIONS_CONFIG);
  return factory(functions) as APP_CODE_PREFIXFirebaseFunctionsGetter;
}
