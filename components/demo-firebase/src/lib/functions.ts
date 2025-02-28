import { FirebaseFunctionGetter, FirebaseFunctionsConfigMap, FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY, lazyFirebaseFunctionsFactory, notificationFunctionMap, NotificationFunctions, NotificationFunctionTypeMap } from '@dereekb/firebase';
import { Functions } from 'firebase/functions';
import { demoDevelopmentFunctionMap, DemoDevelopmentFunctions, DemoDevelopmentFunctionTypeMap } from './development';
import { ProfileFunctionTypeMap, guestbookFunctionMap, GuestbookFunctions, GuestbookFunctionTypeMap, profileFunctionMap, ProfileFunctions, SystemStateFunctions, systemStateFunctionMap, SystemStateFunctionTypeMap } from './model';

/**
 * FirebaseFunctionsMap type for Demo
 */
export type DemoFirebaseFunctionsMap = {
  guestbookFunctions: GuestbookFunctionTypeMap;
  profileFunctions: ProfileFunctionTypeMap;
  notificationFunctions: NotificationFunctionTypeMap;
  systemStateFunctions: SystemStateFunctionTypeMap;
  [FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY]: DemoDevelopmentFunctionTypeMap;
};

/**
 * LazyFirebaseFunctionsConfig for the DemoFirebaseFunctionsMap.
 *
 * The typings are enforced by the functions map.
 *
 * The types here as the first part of the tuple are also made available for Dependency Injection
 */
export const DEMO_FIREBASE_FUNCTIONS_CONFIG: FirebaseFunctionsConfigMap<DemoFirebaseFunctionsMap> = {
  guestbookFunctions: [GuestbookFunctions, guestbookFunctionMap],
  profileFunctions: [ProfileFunctions, profileFunctionMap],
  developmentFunctions: [DemoDevelopmentFunctions, demoDevelopmentFunctionMap],
  notificationFunctions: [NotificationFunctions, notificationFunctionMap],
  systemStateFunctions: [SystemStateFunctions, systemStateFunctionMap]
};

/**
 * The LazyFirebaseFunctions result type. It is an abstract class to allow for dependency injection.
 *
 * The typings are enforced by the functions map.
 */
export abstract class DemoFirebaseFunctionsGetter {
  abstract readonly guestbookFunctions: FirebaseFunctionGetter<GuestbookFunctions>;
  abstract readonly profileFunctions: FirebaseFunctionGetter<ProfileFunctions>;
  abstract readonly developmentFunctions: FirebaseFunctionGetter<DemoDevelopmentFunctions>;
  abstract readonly notificationFunctions: FirebaseFunctionGetter<NotificationFunctions>;
  abstract readonly systemStateFunctions: FirebaseFunctionGetter<SystemStateFunctions>;
}

export function makeDemoFirebaseFunctions(functions: Functions): DemoFirebaseFunctionsGetter {
  const factory = lazyFirebaseFunctionsFactory<DemoFirebaseFunctionsMap>(DEMO_FIREBASE_FUNCTIONS_CONFIG);
  return factory(functions) as DemoFirebaseFunctionsGetter;
}
