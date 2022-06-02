import { firebaseFunctionMapFactory } from '@dereekb/firebase';
import { MaybeNot, build, objectHasKey, cachedGetter } from '@dereekb/util';
import { Functions, httpsCallable } from 'firebase/functions';
import { FirestoreCollectionName, FirestoreModelIdentity, FirestoreModelNames, OnCallUpdateModelParams, UPDATE_MODEL_APP_FUNCTION_KEY } from '../../common';
import { FirebaseFunctionTypeMap, FirebaseFunctionMap, FirebaseFunctionType, FirebaseFunction } from './function';
import { FirebaseFunctionTypeConfigMap } from './function.factory';

export type ModelFirebaseCrudFunctionConfig<T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelNames<T>]: ModelFirebaseCrudFunctionTypeConfig;
};

export type ModelFirebaseCrudFunctionConfigMap<C, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelNames<T>]: ModelFirebaseCrudFunctionTypeConfig;
};

export type ModelFirebaseCrudFunctionTypeConfig = MaybeNot | ModelFirebaseCrudFunctionUpdateTypeConfig | ModelFirebaseCrudFunctionDeleteTypeConfig;

export type ModelFirebaseCrudFunctionUpdateTypeConfig<U = unknown> = {
  update: U;
};

export type ModelFirebaseCrudFunctionDeleteTypeConfig<U = unknown> = {
  delete: U;
};

export type ModelFirebaseFunctionTypeUpdateKey<T extends string> = `update${Capitalize<T>}`;
export type ModelFirebaseFunctionTypeFunctionKey<T extends string> = ModelFirebaseFunctionTypeUpdateKey<T>;

export type ModelFirebaseCrudFunctionMap<U extends ModelFirebaseCrudFunctionConfig<T>, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in keyof U]: boolean;
};

/*
export type ModelFirebaseCrudFunctionMapName<U extends ModelFirebaseCrudFunctionConfig<T>, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in keyof U as ]: boolean;
};
*/

/*
export type UpdateModelFirebaseFunction<I, O = unknown> = FirebaseFunction<OnCallUpdateModelParams<I>, O>;

export type ModelFirebaseFunctionTypeMap<T extends FirestoreCollectionName = FirestoreCollectionName> = {
  [K in T as ModelFirebaseFunctionTypeFunctionKey<K>]: FirebaseFunctionType;
};

// FirebaseFunctionMap extension with the shared CRUD functions.
export type ModelFirebaseFunctionMap<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseFunctionTypeMap<T>, T extends FirestoreCollectionName = FirestoreCollectionName> = FirebaseFunctionMap<M> & {
  [K in keyof U]: K extends ModelFirebaseFunctionTypeUpdateKey<T> ? UpdateModelFirebaseFunction<U[K][0], U[K][1]> : FirebaseFunction<U[K][0], U[K][1]>;
};
*/

export type ModelFirebaseFunctionMap<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseCrudFunctionConfig<T>, T extends FirestoreModelIdentity = FirestoreModelIdentity> = FirebaseFunctionMap<M> & ModelFirebaseCrudFunctionMap<U, T>;
export type ModelFirebaseFunctionMapFunctions<K extends keyof U, U extends ModelFirebaseCrudFunctionConfig<T>, T extends FirestoreModelIdentity = FirestoreModelIdentity> = () => boolean;

/**
 * Used for building a FirebaseFunctionMap<M> for a specific Functions instance.
 */
export type ModelFirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseCrudFunctionConfig<T>, T extends FirestoreModelIdentity = FirestoreModelIdentity> = (functionsInstance: Functions) => ModelFirebaseFunctionMap<M, U, T>;

export function modelFirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseCrudFunctionConfig<T>, T extends FirestoreModelIdentity = FirestoreModelIdentity>(configMap: FirebaseFunctionTypeConfigMap<M>, crudConfigMap: U): ModelFirebaseFunctionMapFactory<M, U, T> {
  const functionFactory = firebaseFunctionMapFactory(configMap);

  return (functionsInstance: Functions) => {
    const functionMap: FirebaseFunctionMap<M> = functionFactory(functionsInstance);

    const updateFn = cachedGetter(() => httpsCallable(functionsInstance, UPDATE_MODEL_APP_FUNCTION_KEY));

    const result = build<ModelFirebaseFunctionMap<M, U, T>>({
      base: functionMap,
      build: (x) => {
        (Object.entries(crudConfigMap) as [FirestoreModelNames<T>, ModelFirebaseCrudFunctionTypeConfig][]).forEach(([modelType, config]) => {
          if (objectHasKey(config, 'update')) {
            x[`update${modelType}`] = updateFn();
          }

          if (objectHasKey(config, 'delete')) {
          }
        });
      }
    });

    return result;
  };
}
