import { cachedGetter } from '@dereekb/util';
import { ClassLikeType, ClassType, forEachKeyValue, Getter, mapObjectMap, Maybe } from '@dereekb/util';
import { Functions, httpsCallable, HttpsCallableOptions } from "firebase/functions";
import { FirebaseFunctionMap, FirebaseFunctionMapFunction, FirebaseFunctionTypeMap } from './function';

// MARK: Functions Factory
export interface FirebaseFunctionTypeConfig {
  options?: HttpsCallableOptions;
}

export type FirebaseFunctionTypeConfigMap<M extends FirebaseFunctionTypeMap> = {
  [K in keyof M]: Maybe<FirebaseFunctionTypeConfig>;
}

/**
 * Used for building a FirebaseFunctionMap<M> for a specific Functions instance.
 */
export type FirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap> = (functionsInstance: Functions) => FirebaseFunctionMap<M>;

export function firebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap>(configMap: FirebaseFunctionTypeConfigMap<M>): FirebaseFunctionMapFactory<M> {
  return (functionsInstance: Functions) => {
    const mapFn = <K extends keyof M>(config: FirebaseFunctionTypeConfigMap<M>[K], key: K) => {
      let httpCallableOptions: HttpsCallableOptions | undefined;

      if (config) {
        httpCallableOptions = config.options;
      }

      const fn: FirebaseFunctionMapFunction<M, K> = httpsCallable(functionsInstance, key as string, httpCallableOptions);
      return fn;
    };

    const result: FirebaseFunctionMap<M> = mapObjectMap<FirebaseFunctionTypeConfigMap<M>>(configMap, mapFn);
    return result;
  };
}

// MARK: Lazy Functions Accessor
export type FirebaseFunctionMapKey = string;
export type FirebaseFunctionGetter<T> = Getter<T> & { _type: ClassLikeType<T>, _key: FirebaseFunctionMapKey };

/**
 * Map of all firebase functions in the app.
 */
export type FirebaseFunctionsMap = {
  [key: FirebaseFunctionMapKey]: FirebaseFunctionTypeMap;
}

export type FirebaseFunctionsConfigMap<M extends FirebaseFunctionsMap> = {
  [K in keyof M]: FirebaseFunctionsConfigMapEntry<M[K]>;
}

export type FirebaseFunctionsConfigMapEntry<M extends FirebaseFunctionTypeMap = any> = [ClassLikeType<any>, FirebaseFunctionMapFactory<M>];

/**
 * Factory function for creating a FirebaseFunctionsMap for a given Functions instance.
 */
export type LazyFirebaseFunctionsFactory<M extends FirebaseFunctionsMap> = (functions: Functions) => LazyFirebaseFunctions<M>;

/**
 * Map of FirebaseFunctionGetter values that are lazy-loaded via the getter.
 */
export type LazyFirebaseFunctions<M extends FirebaseFunctionsMap> = {
  [K in keyof M]: FirebaseFunctionGetter<FirebaseFunctionMap<M[K]>>;
}

export function lazyFirebaseFunctionsFactory<M extends FirebaseFunctionsMap, C extends FirebaseFunctionsConfigMap<M> = FirebaseFunctionsConfigMap<M>>(configMap: C): LazyFirebaseFunctionsFactory<M> {
  return (functions: Functions) => {

    const mapFn = <K extends keyof M>(config: FirebaseFunctionsConfigMapEntry<M[K]>, key: K) => {
      const type = config[0];
      const factory: FirebaseFunctionMapFactory<M[K]> = config[1];
      const getter = cachedGetter(() => factory(functions)) as unknown as FirebaseFunctionGetter<C[K]>;
      getter._type = type;
      getter._key = key as string;
      return getter;
    };

    const result: LazyFirebaseFunctions<M> = mapObjectMap(configMap, mapFn as any);
    return result;
  };
}
