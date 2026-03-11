import { type OnCallDevelopmentParams, type RUN_DEV_FUNCTION_APP_FUNCTION_KEY, SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER } from '@dereekb/firebase';
import { type CallableHttpFunction, type RunnableHttpFunction } from '../../function/type';
import { type NestAppPromiseGetter } from '../app';
import { type NestApplicationScheduleConfiguredFunctionMap } from '../function/schedule';
import { type OnCallHandlerWithNestContextFactory } from '../function/v2/call';
import { type AbstractFirebaseNestContext } from '../nest.provider';
import { onCallDevelopmentFunction, type OnCallDevelopmentFunctionMap } from './development.function';
import { makeScheduledFunctionDevelopmentFunction } from './development.schedule.function';
import { unavailableError } from '../../function/error';
import { inAuthContext } from '../function/call';
import { type Building } from '@dereekb/util';

/**
 * Configuration for {@link firebaseServerDevFunctions}.
 *
 * Controls whether development endpoints are active, what operations they expose,
 * and whether they require authentication. In production, set `enabled: false`
 * to replace dev endpoints with a stub that returns an "unavailable" error.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam S - The schedule function map type.
 */
export interface FirebaseServerDevFunctionsConfig<N extends AbstractFirebaseNestContext<any, any>, S extends NestApplicationScheduleConfiguredFunctionMap> {
  /** When false, dev endpoints return an "unavailable" error instead of executing. */
  readonly enabled: boolean;
  /**
   * Whether or not to require an auth context when calling dev functions. True by default.
   *
   * Set to false only in local development where authentication is unavailable.
   */
  readonly secure?: boolean;
  /** Getter for the NestJS application promise, used to bootstrap the context. */
  readonly nest: NestAppPromiseGetter;
  /** Map of specifier keys to developer utility functions. */
  readonly developerFunctionsMap: OnCallDevelopmentFunctionMap<N>;
  /** Factory that wraps a handler function with NestJS context resolution. */
  readonly onCallFactory: OnCallHandlerWithNestContextFactory<N>;
  /**
   * Whether or not to disable adding the dev schedule function. False by default.
   */
  readonly disableDevelopmentScheduleFunction?: boolean;
  /**
   * Map of all scheduled functions. Used by the dev schedule function. If not provided, the dev schedule function is not generated.
   */
  readonly allScheduledFunctions?: S;
}

/**
 * The output of {@link firebaseServerDevFunctions}, containing the `dev` callable function
 * keyed by {@link RUN_DEV_FUNCTION_APP_FUNCTION_KEY}.
 *
 * Spread this into your Firebase Functions exports to register the dev endpoint.
 */
export interface FirebaseServerDevFunctions {
  readonly [RUN_DEV_FUNCTION_APP_FUNCTION_KEY]: RunnableHttpFunction<OnCallDevelopmentParams> | CallableHttpFunction<OnCallDevelopmentParams>;
}

/**
 * Creates the development callable function bundle for a Firebase + NestJS server.
 *
 * When `enabled` is true, wires together the developer function map, optionally
 * includes the scheduled-function runner, and wraps everything in the NestJS context.
 * When `enabled` is false, returns a stub that throws an "unavailable" error.
 *
 * @param config - Controls which dev functions are exposed and how they are secured.
 * @returns An object with the `dev` function, ready to be spread into Firebase exports.
 *
 * @example
 * ```typescript
 * const devFunctions = firebaseServerDevFunctions({
 *   enabled: environment.dev,
 *   nest: getNestApp,
 *   developerFunctionsMap: { initData: initDataFunction },
 *   onCallFactory: myOnCallFactory,
 *   allScheduledFunctions: scheduledFunctions
 * });
 *
 * export const { dev } = devFunctions;
 * ```
 */
export function firebaseServerDevFunctions<N extends AbstractFirebaseNestContext<any, any>, S extends NestApplicationScheduleConfiguredFunctionMap>(config: FirebaseServerDevFunctionsConfig<N, S>): FirebaseServerDevFunctions {
  const { enabled, secure, nest, developerFunctionsMap, onCallFactory, allScheduledFunctions, disableDevelopmentScheduleFunction } = config;

  let dev: RunnableHttpFunction<OnCallDevelopmentParams> | CallableHttpFunction<OnCallDevelopmentParams>;

  if (enabled) {
    const fullFunctionsMap: OnCallDevelopmentFunctionMap<N> = {
      ...developerFunctionsMap
    };

    if (allScheduledFunctions && disableDevelopmentScheduleFunction !== false) {
      (fullFunctionsMap as Building<OnCallDevelopmentFunctionMap<N>>)[SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER] = makeScheduledFunctionDevelopmentFunction({
        allScheduledFunctions
      });
    }

    let onCallFunction = onCallDevelopmentFunction(fullFunctionsMap);

    if (secure != false) {
      onCallFunction = inAuthContext(onCallFunction);
    }

    dev = onCallFactory(onCallFunction)(nest);
  } else {
    dev = onCallFactory(async (x) => {
      throw unavailableError({
        message: 'developer tools service is not enabled.'
      });
    })(nest);
  }

  return {
    dev
  };
}
