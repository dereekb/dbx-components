import {
  type CalendarFunctionTypeMap,
  calendarFunctionMap,
  CalendarFunctions,
  type FirebaseFunctionGetter,
  type FirebaseFunctionsConfigMap,
  type FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY,
  lazyFirebaseFunctionsFactory,
  notificationFunctionMap,
  NotificationFunctions,
  type NotificationFunctionTypeMap,
  storageFileFunctionMap,
  StorageFileFunctions,
  type StorageFileFunctionTypeMap,
  formSpaceFunctionMap,
  FormSpaceFunctions,
  type FormSpaceFunctionTypeMap,
  type OidcModelFunctionTypeMap,
  oidcModelFunctionMap,
  OidcModelFunctions,
  type UserExternalConnectionFunctionTypeMap,
  userExternalConnectionFunctionMap,
  UserExternalConnectionFunctions
} from '@dereekb/firebase';
import { type Functions } from 'firebase/functions';
import { demoDevelopmentFunctionMap, DemoDevelopmentFunctions, type DemoDevelopmentFunctionTypeMap } from './development';
import { type ProfileFunctionTypeMap, guestbookFunctionMap, GuestbookFunctions, type GuestbookFunctionTypeMap, profileFunctionMap, ProfileFunctions, SystemStateFunctions, systemStateFunctionMap, type SystemStateFunctionTypeMap } from './model';

/**
 * FirebaseFunctionsMap type for Demo
 */
export type DemoFirebaseFunctionsMap = {
  readonly guestbookFunctions: GuestbookFunctionTypeMap;
  readonly profileFunctions: ProfileFunctionTypeMap;
  readonly notificationFunctions: NotificationFunctionTypeMap;
  readonly storageFileFunctions: StorageFileFunctionTypeMap;
  readonly formSpaceFunctions: FormSpaceFunctionTypeMap;
  readonly systemStateFunctions: SystemStateFunctionTypeMap;
  readonly calendarFunctions: CalendarFunctionTypeMap;
  readonly oidcModelFunctions: OidcModelFunctionTypeMap;
  readonly userExternalConnectionFunctions: UserExternalConnectionFunctionTypeMap;
  readonly [FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY]: DemoDevelopmentFunctionTypeMap;
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
  storageFileFunctions: [StorageFileFunctions, storageFileFunctionMap],
  calendarFunctions: [CalendarFunctions, calendarFunctionMap],
  formSpaceFunctions: [FormSpaceFunctions, formSpaceFunctionMap],
  oidcModelFunctions: [OidcModelFunctions, oidcModelFunctionMap],
  userExternalConnectionFunctions: [UserExternalConnectionFunctions, userExternalConnectionFunctionMap],
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
  abstract readonly storageFileFunctions: FirebaseFunctionGetter<StorageFileFunctions>;
  abstract readonly calendarFunctions: FirebaseFunctionGetter<CalendarFunctions>;
  abstract readonly formSpaceFunctions: FirebaseFunctionGetter<FormSpaceFunctions>;
  abstract readonly oidcModelFunctions: FirebaseFunctionGetter<OidcModelFunctions>;
  abstract readonly userExternalConnectionFunctions: FirebaseFunctionGetter<UserExternalConnectionFunctions>;
  abstract readonly systemStateFunctions: FirebaseFunctionGetter<SystemStateFunctions>;
}

/**
 * Creates a DemoFirebaseFunctionsGetter instance from the given Firebase Functions reference.
 *
 * Uses the DEMO_FIREBASE_FUNCTIONS_CONFIG to lazily initialize all function getters.
 *
 * @param functions - The Firebase Functions instance to bind to.
 * @returns A DemoFirebaseFunctionsGetter with lazy accessors for each function group.
 */
export function makeDemoFirebaseFunctions(functions: Functions): DemoFirebaseFunctionsGetter {
  const factory = lazyFirebaseFunctionsFactory<DemoFirebaseFunctionsMap>(DEMO_FIREBASE_FUNCTIONS_CONFIG);
  return factory(functions) as DemoFirebaseFunctionsGetter;
}
