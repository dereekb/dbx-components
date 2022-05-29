import { FirebaseFunctionGetter, FirebaseFunctionsConfigMap, lazyFirebaseFunctionsFactory } from '@dereekb/firebase';
import { Functions } from 'firebase/functions';
import { ProfileFunctionTypeMap, guestbookFunctionMap, GuestbookFunctions, GuestbookFunctionTypeMap, profileFunctionMap, ProfileFunctions } from './models';

/**
 * FirebaseFunctionsMap type for Demo
 */
export type DemoFirebaseFunctionsMap = {
  guestbookFunctions: GuestbookFunctionTypeMap;
  profileFunctions: ProfileFunctionTypeMap;
};

/**
 * LazyFirebaseFunctionsConfig for the DemoFirebaseFunctionsMap.
 *
 * The typings are enforced by the functions map.
 */
export const DEMO_FIREBASE_FUNCTIONS_CONFIG: FirebaseFunctionsConfigMap<DemoFirebaseFunctionsMap> = {
  guestbookFunctions: [GuestbookFunctions, guestbookFunctionMap],
  profileFunctions: [ProfileFunctions, profileFunctionMap]
};

/**
 * The LazyFirebaseFunctions result type. It is an abstract class to allow for dependency injection.
 *
 * The typings are enforced by the functions map.
 */
export abstract class DemoFirebaseFunctionsGetter {
  abstract readonly guestbookFunctions: FirebaseFunctionGetter<GuestbookFunctions>;
  abstract readonly profileFunctions: FirebaseFunctionGetter<ProfileFunctions>;
}

export function makeDemoFirebaseFunctions(functions: Functions): DemoFirebaseFunctionsGetter {
  const factory = lazyFirebaseFunctionsFactory<DemoFirebaseFunctionsMap>(DEMO_FIREBASE_FUNCTIONS_CONFIG);
  return factory(functions);
}
