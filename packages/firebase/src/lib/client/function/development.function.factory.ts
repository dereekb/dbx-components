/* eslint-disable @typescript-eslint/no-explicit-any */
// The use of any here does not degrade the type-safety. The correct type is inferred in most cases.

import { Getter, mapObjectMap, cachedGetter } from '@dereekb/util';
import { Functions, httpsCallable, HttpsCallable } from 'firebase/functions';
import { onCallDevelopmentParams, RUN_DEV_FUNCTION_APP_FUNCTION_KEY } from '../../common/development/function';
import { FirebaseFunctionTypeMap, FirebaseFunctionMap } from './function';
import { mapHttpsCallable } from './function.callable';
import { FirebaseFunctionTypeConfigMap } from './function.factory';

export type DevelopmentFirebaseFunctionTypeMap = FirebaseFunctionTypeMap;

/**
 * The configuration for a types map.
 */
export type DevelopmentFirebaseFunctionConfigMap<M extends DevelopmentFirebaseFunctionTypeMap> = FirebaseFunctionTypeConfigMap<M>;

export type DevelopmentFirebaseFunctionMap<M extends DevelopmentFirebaseFunctionTypeMap> = FirebaseFunctionMap<M>;

/**
 * Used for building a FirebaseFunctionMap<M> for a specific Functions instance.
 */
export type DevelopmentFirebaseFunctionMapFactory<M extends DevelopmentFirebaseFunctionTypeMap> = (functionsInstance: Functions) => DevelopmentFirebaseFunctionMap<M>;

export function developmentFirebaseFunctionMapFactory<M extends DevelopmentFirebaseFunctionTypeMap>(configMap: DevelopmentFirebaseFunctionConfigMap<M>): DevelopmentFirebaseFunctionMapFactory<M> {
  return (functionsInstance: Functions) => {
    const _devFn = cachedGetter(() => httpsCallable(functionsInstance, RUN_DEV_FUNCTION_APP_FUNCTION_KEY));

    function makeFunction(fn: Getter<HttpsCallable<unknown, unknown>>, specifier: string) {
      return mapHttpsCallable(fn(), { mapInput: (data) => onCallDevelopmentParams(specifier, data) }, true);
    }

    const functionsMap: DevelopmentFirebaseFunctionMap<M> = mapObjectMap(configMap, (enabled, specifier) => {
      return makeFunction(_devFn, specifier as string);
    });

    return functionsMap;
  };
}
