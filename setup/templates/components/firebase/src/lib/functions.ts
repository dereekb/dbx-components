import { ExampleFunctionTypeMap } from './example/example.api';
import { FirebaseFunctionGetter, FirebaseFunctionsConfigMap, lazyFirebaseFunctionsFactory } from '@dereekb/firebase';
import { Functions } from 'firebase/functions';
import { exampleFunctionMap, ExampleFunctions } from './example';

export type APP_CODE_PREFIXFirebaseFunctionsMap = {
  exampleFunctions: ExampleFunctionTypeMap;
}

export const APP_CODE_PREFIX_UPPER_FIREBASE_FUNCTIONS_CONFIG: FirebaseFunctionsConfigMap<APP_CODE_PREFIXFirebaseFunctionsMap> = {
  exampleFunctions: [ExampleFunctions, exampleFunctionMap]
};

export abstract class APP_CODE_PREFIXFirebaseFunctionsGetter {
  abstract readonly exampleFunctions: FirebaseFunctionGetter<ExampleFunctions>;
}

export function makeDemoFirebaseFunctions(functions: Functions): APP_CODE_PREFIXFirebaseFunctionsGetter {
  const factory = lazyFirebaseFunctionsFactory<APP_CODE_PREFIXFirebaseFunctionsMap>(APP_CODE_PREFIX_UPPER_FIREBASE_FUNCTIONS_CONFIG);
  return factory(functions);
}
