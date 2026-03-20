/* eslint-disable @typescript-eslint/no-explicit-any */
// The use of any here does not degrade the type-safety. The correct type is inferred in most cases.

import { cachedGetter, type ClassLikeType, type Getter, mapObjectMap, type Maybe } from '@dereekb/util';
import { type Functions, httpsCallable, type HttpsCallableOptions } from 'firebase/functions';
import { type FirebaseFunctionMap, type FirebaseFunctionMapFunction, type FirebaseFunctionTypeMap } from './function';
import { directDataHttpsCallable } from './function.callable';

// MARK: Functions Factory
/**
 * Per-function configuration for creating `HttpsCallable` instances, allowing
 * custom `HttpsCallableOptions` (e.g., timeout) per function key.
 */
export interface FirebaseFunctionTypeConfig {
  readonly options?: HttpsCallableOptions;
}

/**
 * Maps each function key in a {@link FirebaseFunctionTypeMap} to its optional configuration.
 */
export type FirebaseFunctionTypeConfigMap<M extends FirebaseFunctionTypeMap> = {
  readonly [K in keyof M]: Maybe<FirebaseFunctionTypeConfig>;
};

/**
 * Factory that creates a {@link FirebaseFunctionMap} for a given `Functions` instance.
 *
 * Call this with a live `Functions` instance to get a map of typed callable functions
 * ready to invoke.
 */
export type FirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap> = (functionsInstance: Functions) => FirebaseFunctionMap<M>;

/**
 * Creates a {@link FirebaseFunctionMapFactory} from a configuration map.
 *
 * Each key in the config map becomes an `HttpsCallable` function wrapped with {@link directDataHttpsCallable}
 * for direct data access. Per-key options (e.g., timeout) are applied if provided.
 *
 * @param configMap - maps function keys to their optional configuration
 * @returns a {@link FirebaseFunctionMapFactory} that creates a typed callable function map for a given `Functions` instance
 *
 * @example
 * ```ts
 * const factory = firebaseFunctionMapFactory<MyFunctionTypeMap>({
 *   createUser: { options: { timeout: 30000 } },
 *   deleteUser: null
 * });
 * const functions = factory(getFunctions());
 * const result = await functions.createUser({ name: 'Alice' });
 * ```
 */
export function firebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap>(configMap: FirebaseFunctionTypeConfigMap<M>): FirebaseFunctionMapFactory<M> {
  return (functionsInstance: Functions) => {
    const mapFn = <K extends keyof M>(config: FirebaseFunctionTypeConfigMap<M>[K], key: K) => {
      let httpCallableOptions: HttpsCallableOptions | undefined;

      if (config) {
        httpCallableOptions = config.options;
      }

      const fn: FirebaseFunctionMapFunction<M, K> = directDataHttpsCallable<M[K][0], M[K][1]>(httpsCallable<M[K][0], M[K][1]>(functionsInstance, key as string, httpCallableOptions));
      return fn;
    };

    return mapObjectMap<FirebaseFunctionTypeConfigMap<M>>(configMap, mapFn) as FirebaseFunctionMap<M>;
  };
}

// MARK: Lazy Functions Accessor
/**
 * String key used to identify a function group in the app-level functions map.
 */
export type FirebaseFunctionMapKey = string;

/**
 * Lazy getter that also carries metadata about the function group's type and key.
 *
 * The `_type` property holds the class constructor for type identification (used by injection),
 * and `_key` holds the string key in the app-level {@link FirebaseFunctionsMap}.
 */
export type FirebaseFunctionGetter<T> = Getter<T> & { _type: ClassLikeType<T>; _key: FirebaseFunctionMapKey };

/**
 * Top-level map of all function groups in the app. Each key represents a logical function group
 * (e.g., `'notificationFunctions'`, `'developmentFunctions'`) mapped to its {@link FirebaseFunctionTypeMap}.
 */
export type FirebaseFunctionsMap = {
  readonly [key: FirebaseFunctionMapKey]: FirebaseFunctionTypeMap;
};

/**
 * Configuration map for building a {@link LazyFirebaseFunctions} instance.
 * Each entry pairs a class type (for DI identification) with a factory function.
 */
export type FirebaseFunctionsConfigMap<M extends FirebaseFunctionsMap> = {
  readonly [K in keyof M]: FirebaseFunctionsConfigMapEntry<M[K]>;
};

/**
 * Tuple of `[ClassType, FactoryFunction]` for a single function group entry.
 */
export type FirebaseFunctionsConfigMapEntry<M extends FirebaseFunctionTypeMap> = [ClassLikeType, FirebaseFunctionMapFactory<M>];

/**
 * Factory that creates a {@link LazyFirebaseFunctions} map for a given `Functions` instance.
 */
export type LazyFirebaseFunctionsFactory<M extends FirebaseFunctionsMap> = (functions: Functions) => LazyFirebaseFunctions<M>;

/**
 * Map of lazy-loaded function groups. Each group is a {@link FirebaseFunctionGetter} that
 * defers initialization until first access via `cachedGetter`, avoiding unnecessary
 * `httpsCallable` instantiation for unused function groups.
 */
export type LazyFirebaseFunctions<M extends FirebaseFunctionsMap> = {
  readonly [K in keyof M]: FirebaseFunctionGetter<FirebaseFunctionMap<M[K]>>;
};

/**
 * Creates a {@link LazyFirebaseFunctionsFactory} from a config map of function groups.
 *
 * Each function group is lazily initialized on first access using `cachedGetter`,
 * so `httpsCallable` instances are only created when actually needed.
 *
 * @param configMap - maps each function group key to its `[ClassType, Factory]` tuple
 * @returns a {@link LazyFirebaseFunctionsFactory} that creates a lazy-loaded function map for a given `Functions` instance
 *
 * @example
 * ```ts
 * const factory = lazyFirebaseFunctionsFactory<AppFunctionsMap>({
 *   notificationFunctions: [NotificationFunctions, notificationFunctionMapFactory],
 *   developmentFunctions: [DevelopmentFunctions, devFunctionMapFactory]
 * });
 *
 * const lazyFns = factory(getFunctions());
 * const notifFns = lazyFns.notificationFunctions(); // initialized on first call
 * ```
 */
export function lazyFirebaseFunctionsFactory<M extends FirebaseFunctionsMap, C extends FirebaseFunctionsConfigMap<M> = FirebaseFunctionsConfigMap<M>>(configMap: C): LazyFirebaseFunctionsFactory<M> {
  return (functions: Functions) => {
    const mapFn = <K extends keyof M>(config: FirebaseFunctionsConfigMapEntry<M[K]>, key: K) => {
      const type = config[0];
      const factory: FirebaseFunctionMapFactory<M[K]> = config[1];
      const getter = cachedGetter(() => factory(functions)) as unknown as FirebaseFunctionGetter<C[K]>;
      getter._type = type as ClassLikeType<C[K]>;
      getter._key = key as string;
      return getter;
    };

    const result: LazyFirebaseFunctions<M> = mapObjectMap(configMap, mapFn as any);
    return result;
  };
}
