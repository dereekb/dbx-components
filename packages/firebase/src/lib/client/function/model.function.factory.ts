import { firebaseFunctionMapFactory } from '@dereekb/firebase';
import { MaybeNot, build, cachedGetter, capitalizeFirstLetter } from '@dereekb/util';
import { Functions, httpsCallable } from 'firebase/functions';
import { NonNever } from 'ts-essentials';
import { DELETE_MODEL_APP_FUNCTION_KEY, FirestoreModelIdentity, FirestoreModelNames, OnCallDeleteModelParams, OnCallUpdateModelParams, UPDATE_MODEL_APP_FUNCTION_KEY } from '../../common';
import { FirebaseFunctionTypeMap, FirebaseFunctionMap, FirebaseFunction } from './function';
import { mapHttpsCallable } from './function.callable';
import { FirebaseFunctionTypeConfigMap } from './function.factory';

export type ModelFirebaseCrudFunction<I> = FirebaseFunction<I, void>;

export type ModelFirebaseCrudFunctionTypeMap<T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelNames<T>]: ModelFirebaseCrudFunctionTypeMapEntry;
};

export type ModelFirebaseCrudFunctionTypeMapEntry = MaybeNot | Partial<ModelFirebaseCrudFunctionUpdateTypeConfig & ModelFirebaseCrudFunctionDeleteTypeConfig>;

export type ModelFirebaseCrudFunctionUpdateTypeConfig<I = unknown> = {
  update: I;
};

export type ModelFirebaseCrudFunctionDeleteTypeConfig<I = unknown> = {
  delete: I;
};

export type ModelFirebaseCrudFunctionConfigMap<C extends ModelFirebaseCrudFunctionTypeMap> = NonNever<{
  [K in keyof C]: C[K] extends null ? never : (keyof C[K])[];
}>;

export type ModelFirebaseFunctionTypeUpdateKey<T extends string> = `update${Capitalize<T>}`;
export type ModelFirebaseFunctionTypeFunctionKey<T extends string> = ModelFirebaseFunctionTypeUpdateKey<T>;

export type ModelFirebaseCrudFunctionMap<C extends ModelFirebaseCrudFunctionTypeMap> = ModelFirebaseCrudFunctionRawMap<C>;

export type ModelFirebaseCrudFunctionRawMap<C extends ModelFirebaseCrudFunctionTypeMap> = NonNever<{
  [K in keyof C]: K extends string ? ModelFirebaseCrudFunctionMapEntry<K, C[K]> : never;
}>;

export type ModelFirebaseCrudFunctionName<T extends string, K extends string> = `${K}${Capitalize<T>}`;

export type ModelFirebaseCrudFunctionMapEntry<T extends string, E extends ModelFirebaseCrudFunctionTypeMapEntry> = E extends null
  ? never
  : {
      [K in keyof E as K extends string ? ModelFirebaseCrudFunctionName<T, K> : never]: ModelFirebaseCrudFunction<E[K]>;
    };

export type ModelFirebaseFunctionMap<M extends FirebaseFunctionTypeMap, C extends ModelFirebaseCrudFunctionTypeMap> = FirebaseFunctionMap<M> & ModelFirebaseCrudFunctionMap<C>;

/**
 * Used for building a FirebaseFunctionMap<M> for a specific Functions instance.
 */
export type ModelFirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseCrudFunctionTypeMap> = (functionsInstance: Functions) => ModelFirebaseFunctionMap<M, U>;

export function modelFirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseCrudFunctionTypeMap>(configMap: FirebaseFunctionTypeConfigMap<M>, crudConfigMap: ModelFirebaseCrudFunctionConfigMap<U>): ModelFirebaseFunctionMapFactory<M, U> {
  const functionFactory = firebaseFunctionMapFactory(configMap);

  return (functionsInstance: Functions) => {
    const functionMap: FirebaseFunctionMap<M> = functionFactory(functionsInstance);

    const _updateFn = cachedGetter(() => httpsCallable(functionsInstance, UPDATE_MODEL_APP_FUNCTION_KEY));
    const _deleteFn = cachedGetter(() => httpsCallable(functionsInstance, DELETE_MODEL_APP_FUNCTION_KEY));

    const result = build<ModelFirebaseFunctionMap<M, U>>({
      base: functionMap as unknown as ModelFirebaseFunctionMap<M, U>,
      build: (x) => {
        Object.entries(crudConfigMap).forEach(([modelType, config]) => {
          const modelTypeSuffix = capitalizeFirstLetter(modelType);
          const crudFunctions = new Set(config as string[]);
          const modelTypeCruds = {};

          if (crudFunctions.has('update')) {
            (modelTypeCruds as any)[`update${modelTypeSuffix}`] = mapHttpsCallable(_updateFn(), { mapInput: (data) => ({ modelType, data } as OnCallUpdateModelParams) });
          }

          if (crudFunctions.has('delete')) {
            (modelTypeCruds as any)[`delete${modelTypeSuffix}`] = mapHttpsCallable(_deleteFn(), { mapInput: (data) => ({ modelType, data } as OnCallDeleteModelParams) });
          }

          // tslint:disable-next-line
          (x as any)[modelType] = modelTypeCruds;
        });
      }
    });

    return result;
  };
}
