import { mapObjectMap, Maybe } from '@dereekb/util';
import { Functions, httpsCallable, HttpsCallableOptions } from "firebase/functions";
import { FirebaseFunctionMap, FirebaseFunctionMapFunction, FirebaseFunctionTypeMap } from './function';

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
