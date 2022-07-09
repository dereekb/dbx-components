/* eslint-disable @typescript-eslint/no-explicit-any */
// The use of any here does not degrade the type-safety. The correct type is inferred in most cases.

import { firebaseFunctionMapFactory } from '@dereekb/firebase';
import { MaybeNot, build, cachedGetter, capitalizeFirstLetter, ValuesTypesAsArray, CommaSeparatedKeysOfObject, separateValues, Getter, ClassLikeType, ClassType, lowercaseFirstLetter } from '@dereekb/util';
import { Functions, HttpsCallable, httpsCallable } from 'firebase/functions';
import { NonNever } from 'ts-essentials';
import { CREATE_MODEL_APP_FUNCTION_KEY, DELETE_MODEL_APP_FUNCTION_KEY, FirestoreModelIdentity, FirestoreModelTypes, OnCallCreateModelResult, onCallTypedModelParams, UPDATE_MODEL_APP_FUNCTION_KEY } from '../../common';
import { FirebaseFunctionTypeMap, FirebaseFunctionMap, FirebaseFunction } from './function';
import { mapHttpsCallable } from './function.callable';
import { FirebaseFunctionTypeConfigMap } from './function.factory';

/**
 * Used to specify which function to direct requests to.
 */
export type ModelFirebaseCrudFunctionSpecifier = string;

/**
 * Provides a reference to a ModelFirebaseCrudFunctionSpecifier if available.
 */
export type ModelFirebaseCrudFunctionSpecifierRef = {
  specifier?: ModelFirebaseCrudFunctionSpecifier;
};

export type ModelFirebaseCrudFunction<I> = FirebaseFunction<I, void>;
export type ModelFirebaseCreateFunction<I, O extends OnCallCreateModelResult = OnCallCreateModelResult> = FirebaseFunction<I, O>;
export type ModelFirebaseUpdateFunction<I> = ModelFirebaseCrudFunction<I>;
export type ModelFirebaseDeleteFunction<I> = ModelFirebaseCrudFunction<I>;

export type ModelFirebaseCrudFunctionTypeMap<T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelTypes<T>]: ModelFirebaseCrudFunctionTypeMapEntry;
};

export type ModelFirebaseCrudFunctionTypeMapEntry = MaybeNot | Partial<ModelFirebaseCrudFunctionCreateTypeConfig & ModelFirebaseCrudFunctionUpdateTypeConfig & ModelFirebaseCrudFunctionDeleteTypeConfig>;
export type ModelFirebaseCrudFunctionCreateTypeSpecifierConfig = Record<string | number, unknown>;

// TODO: Typings here could potentially be improved to always enforce _ being provided if the passed object is

export type ModelFirebaseCrudFunctionCreateTypeConfig = {
  create: unknown | ModelFirebaseCrudFunctionCreateTypeSpecifierConfig;
};

export type ModelFirebaseCrudFunctionUpdateTypeConfig = {
  update: unknown | ModelFirebaseCrudFunctionCreateTypeSpecifierConfig;
};

export type ModelFirebaseCrudFunctionDeleteTypeConfig = {
  delete: unknown | ModelFirebaseCrudFunctionCreateTypeSpecifierConfig;
};

export const MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT = '_';
export type ModelFirebaseCrudFunctionSpecifierDefault = typeof MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT;

export const MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_SPLITTER = ',';
export type ModelFirebaseCrudFunctionSpecifierSplitter = typeof MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_SPLITTER;

/**
 * The configuration for a types map.
 *
 * The FirestoreModelIdentities that are allowed are passed too which add type checking to make sure we're passing the expected identities.
 */
export type ModelFirebaseCrudFunctionConfigMap<C extends ModelFirebaseCrudFunctionTypeMap<T>, T extends FirestoreModelIdentity> = NonNever<{
  [K in FirestoreModelTypes<T>]: C[K] extends null ? never : ModelFirebaseCrudFunctionConfigMapEntry<C[K]>;
}>;

export type ModelFirebaseCrudFunctionConfigMapEntry<T> = ValuesTypesAsArray<{
  [K in keyof T]: K extends string ? (T[K] extends Record<string, unknown> ? ModelFirebaseCrudFunctionConfigMapEntrySpecifier<K, T[K]> : K) : never;
}>;

export type ModelFirebaseCrudFunctionConfigMapEntrySpecifier<K extends string, M extends object> = `${K}:${CommaSeparatedKeysOfObject<M>}`;

export type ModelFirebaseCrudFunctionMap<C extends ModelFirebaseCrudFunctionTypeMap> = ModelFirebaseCrudFunctionRawMap<C>;

export type ModelFirebaseCrudFunctionRawMap<C extends ModelFirebaseCrudFunctionTypeMap> = NonNever<{
  [K in keyof C]: K extends string ? ModelFirebaseCrudFunctionMapEntry<K, C[K]> : never;
}>;

export type ModelFirebaseCrudFunctionName<MODEL extends string, CRUD extends string> = `${CRUD}${Capitalize<MODEL>}`;
export type ModelFirebaseCrudFunctionWithSpecifierName<MODEL extends string, CRUD extends string, SPECIFIER extends string> = `${CRUD}${Capitalize<MODEL>}${Capitalize<SPECIFIER>}`;

export type ModelFirebaseCrudFunctionMapEntry<MODEL extends string, E extends ModelFirebaseCrudFunctionTypeMapEntry> = E extends null
  ? never
  : {
      [CRUD in keyof E as CRUD extends string ? (E[CRUD] extends Record<string, unknown> ? never : ModelFirebaseCrudFunctionName<MODEL, CRUD>) : never]: ModelFirebaseCrudFunctionMapEntryFunction<E, CRUD>;
    } & {
      [CRUD in keyof E as CRUD extends string ? (E[CRUD] extends Record<string, unknown> ? ModelFirebaseCrudFunctionName<MODEL, CRUD> : never) : never]: CRUD extends string ? ModelFirebaseCrudFunctionMapEntrySpecifier<MODEL, CRUD, E[CRUD]> | ModelFirebaseCrudFunctionMapEntrySpecifierShort<MODEL, CRUD, E[CRUD]> : never;
    };

export type ModelFirebaseCrudFunctionMapEntrySpecifier<MODEL extends string, CRUD extends string, M> = {
  [SPECIFIER in keyof M as SPECIFIER extends string ? (CRUD extends string ? (SPECIFIER extends ModelFirebaseCrudFunctionSpecifierDefault ? ModelFirebaseCrudFunctionName<MODEL, CRUD> : ModelFirebaseCrudFunctionWithSpecifierName<MODEL, CRUD, SPECIFIER>) : never) : never]: ModelFirebaseCrudFunctionMapEntryFunction<M, SPECIFIER>;
};

export type ModelFirebaseCrudFunctionMapEntrySpecifierShort<MODEL extends string, CRUD extends string, M> = {
  [SPECIFIER in keyof M as SPECIFIER extends string ? (CRUD extends string ? (SPECIFIER extends ModelFirebaseCrudFunctionSpecifierDefault ? CRUD : SPECIFIER) : never) : never]: ModelFirebaseCrudFunctionMapEntryFunction<M, SPECIFIER>;
};

export type ModelFirebaseCrudFunctionMapEntryFunction<E extends ModelFirebaseCrudFunctionTypeMapEntry, K extends keyof E> = K extends 'create' ? ModelFirebaseCreateFunction<E[K]> : ModelFirebaseCrudFunction<E[K]>;

export type ModelFirebaseFunctionMap<M extends FirebaseFunctionTypeMap, C extends ModelFirebaseCrudFunctionTypeMap> = FirebaseFunctionMap<M> & ModelFirebaseCrudFunctionMap<C>;

/**
 * Used for building a FirebaseFunctionMap<M> for a specific Functions instance.
 */
export type ModelFirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseCrudFunctionTypeMap> = (functionsInstance: Functions) => ModelFirebaseFunctionMap<M, U>;

export function modelFirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseCrudFunctionTypeMap>(configMap: FirebaseFunctionTypeConfigMap<M>, crudConfigMap: ModelFirebaseCrudFunctionConfigMap<U, FirestoreModelIdentity>): ModelFirebaseFunctionMapFactory<M, U> {
  const functionFactory = firebaseFunctionMapFactory(configMap);

  return (functionsInstance: Functions) => {
    const functionMap: FirebaseFunctionMap<M> = functionFactory(functionsInstance);

    const _createFn = cachedGetter(() => httpsCallable(functionsInstance, CREATE_MODEL_APP_FUNCTION_KEY));
    const _updateFn = cachedGetter(() => httpsCallable(functionsInstance, UPDATE_MODEL_APP_FUNCTION_KEY));
    const _deleteFn = cachedGetter(() => httpsCallable(functionsInstance, DELETE_MODEL_APP_FUNCTION_KEY));

    function makeCrudFunction(fn: Getter<HttpsCallable<unknown, unknown>>, modelType: string, specifier?: string) {
      return mapHttpsCallable(fn(), { mapInput: (data) => onCallTypedModelParams(modelType, data, specifier) }, true);
    }

    function makeCrudSpecifiers(crud: string, fn: Getter<HttpsCallable<unknown, unknown>>, modelType: string, specifierKeys: string[]): { [key: string]: HttpsCallable<unknown, unknown> } {
      const modelTypeSuffix = capitalizeFirstLetter(modelType);
      const specifiers: Record<string, HttpsCallable<unknown, unknown>> = {};

      specifierKeys.forEach((inputSpecifier) => {
        const specifier = inputSpecifier === MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT ? '' : inputSpecifier;
        const specifierFn = makeCrudFunction(fn, modelType, inputSpecifier) as HttpsCallable<unknown, unknown>;

        const fullSpecifierName = `${crud}${modelTypeSuffix}${capitalizeFirstLetter(specifier)}`;
        specifiers[fullSpecifierName] = specifierFn;

        const shortSpecifierName = lowercaseFirstLetter(specifier) ?? crud;
        specifiers[shortSpecifierName] = specifierFn;
      });

      return specifiers;
    }

    const result = build<ModelFirebaseFunctionMap<M, U>>({
      base: functionMap as unknown as ModelFirebaseFunctionMap<M, U>,
      build: (x) => {
        Object.entries(crudConfigMap).forEach(([modelType, config]) => {
          const modelTypeSuffix = capitalizeFirstLetter(modelType);
          const { included: crudFunctionKeys, excluded: specifiedCrudFunctionKeys } = separateValues(config as string[], (x) => x.indexOf(':') === -1);

          const crudFunctions = new Set(crudFunctionKeys);
          const specifierFunctions = new Map<string, string[]>(
            specifiedCrudFunctionKeys.map((x) => {
              const [crud, functionsSplit] = x.split(':', 2);
              const functions = functionsSplit.split(MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_SPLITTER);

              return [crud, functions];
            })
          );

          function addFunctions(crud: string, fn: Getter<HttpsCallable<unknown, unknown>>, modelType: string): void {
            let crudFns: unknown;

            if (crudFunctions.has(crud)) {
              crudFns = makeCrudFunction(fn, modelType);
            } else if (specifierFunctions.has(crud)) {
              crudFns = makeCrudSpecifiers(crud, fn, modelType, specifierFunctions.get(crud) as string[]);
            }

            if (crudFns) {
              (modelTypeCruds as any)[`${crud}${modelTypeSuffix}`] = crudFns;
            }
          }

          const modelTypeCruds = {};

          addFunctions('create', _createFn, modelType);
          addFunctions('update', _updateFn, modelType);
          addFunctions('delete', _deleteFn, modelType);

          // tslint:disable-next-line
          (x as any)[modelType] = modelTypeCruds;
        });
      }
    });

    return result;
  };
}
