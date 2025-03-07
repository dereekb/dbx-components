/* eslint-disable @typescript-eslint/no-explicit-any */
// The use of any here does not degrade the type-safety. The correct type is inferred in most cases.

import { type MaybeNot, build, cachedGetter, capitalizeFirstLetter, type ValuesTypesAsArray, type CommaSeparatedKeysOfObject, separateValues, type Getter, lowercaseFirstLetter } from '@dereekb/util';
import { type Functions, type HttpsCallable, httpsCallable } from 'firebase/functions';
import { type NonNever } from 'ts-essentials';
import { type FirestoreModelIdentity, type FirestoreModelTypes } from '../../common/firestore/collection';
import { type FirebaseFunctionTypeMap, type FirebaseFunctionMap, type FirebaseFunction } from './function';
import { mapHttpsCallable } from './function.callable';
import { type FirebaseFunctionTypeConfigMap, firebaseFunctionMapFactory } from './function.factory';
import { type OnCallCreateModelResult, CALL_MODEL_APP_FUNCTION_KEY, onCallTypedModelParamsFunction } from '../../common/model/function';

/**
 * Used to specify which function to direct requests to.
 */
export type ModelFirebaseCrudFunctionSpecifier = string;

/**
 * Provides a reference to a ModelFirebaseCrudFunctionSpecifier if available.
 */
export type ModelFirebaseCrudFunctionSpecifierRef = {
  readonly specifier?: ModelFirebaseCrudFunctionSpecifier;
};

export type ModelFirebaseCrudFunction<I, O = void> = FirebaseFunction<I, O>;
export type ModelFirebaseCreateFunction<I, O extends OnCallCreateModelResult = OnCallCreateModelResult> = ModelFirebaseCrudFunction<I, O>;
export type ModelFirebaseReadFunction<I, O> = ModelFirebaseCrudFunction<I, O>;
export type ModelFirebaseUpdateFunction<I, O = void> = ModelFirebaseCrudFunction<I, O>;
export type ModelFirebaseDeleteFunction<I, O = void> = ModelFirebaseCrudFunction<I, O>;

export type ModelFirebaseCrudFunctionTypeMap<T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelTypes<T>]: ModelFirebaseCrudFunctionTypeMapEntry;
};

export type ModelFirebaseCrudFunctionTypeMapEntry = MaybeNot | Partial<ModelFirebaseCrudFunctionCreateTypeConfig & ModelFirebaseCrudFunctionReadTypeConfig & ModelFirebaseCrudFunctionUpdateTypeConfig & ModelFirebaseCrudFunctionDeleteTypeConfig>;

export type ModelFirebaseCrudFunctionTypeMapEntryWithReturnType<I = unknown, O = unknown> = [I, O];
export type ModelFirebaseCrudFunctionTypeSpecifierConfig = Record<string | number, unknown | ModelFirebaseCrudFunctionTypeMapEntryWithReturnType>;

export type ModelFirebaseCrudFunctionCreateTypeConfig = {
  readonly create: unknown | ModelFirebaseCrudFunctionTypeSpecifierConfig;
};

export type ModelFirebaseCrudFunctionReadTypeConfig = {
  readonly read: unknown | ModelFirebaseCrudFunctionTypeSpecifierConfig;
};

export type ModelFirebaseCrudFunctionUpdateTypeConfig = {
  readonly update: unknown | ModelFirebaseCrudFunctionTypeSpecifierConfig;
};

export type ModelFirebaseCrudFunctionDeleteTypeConfig = {
  readonly delete: unknown | ModelFirebaseCrudFunctionTypeSpecifierConfig;
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
      [CRUD in keyof E as CRUD extends string ? (E[CRUD] extends Record<string, unknown> ? never : ModelFirebaseCrudFunctionName<MODEL, CRUD>) : never]: CRUD extends string ? ModelFirebaseCrudFunctionMapEntryFunction<E, CRUD, CRUD> : never;
    } & {
      [CRUD in keyof E as CRUD extends string ? (E[CRUD] extends Record<string, unknown> ? ModelFirebaseCrudFunctionName<MODEL, CRUD> : never) : never]: CRUD extends string ? ModelFirebaseCrudFunctionMapEntrySpecifier<MODEL, CRUD, E[CRUD]> | ModelFirebaseCrudFunctionMapEntrySpecifierShort<MODEL, CRUD, E[CRUD]> : never;
    };

export type ModelFirebaseCrudFunctionMapEntrySpecifier<MODEL extends string, CRUD extends string, M extends unknown | ModelFirebaseCrudFunctionTypeSpecifierConfig> = {
  [SPECIFIER in keyof M as SPECIFIER extends string ? (CRUD extends string ? (SPECIFIER extends ModelFirebaseCrudFunctionSpecifierDefault ? ModelFirebaseCrudFunctionName<MODEL, CRUD> : ModelFirebaseCrudFunctionWithSpecifierName<MODEL, CRUD, SPECIFIER>) : never) : never]: ModelFirebaseCrudFunctionMapEntryFunction<M, SPECIFIER, CRUD>;
};

export type ModelFirebaseCrudFunctionMapEntrySpecifierShort<MODEL extends string, CRUD extends string, M extends unknown | ModelFirebaseCrudFunctionTypeSpecifierConfig> = {
  [SPECIFIER in keyof M as SPECIFIER extends string ? (CRUD extends string ? (SPECIFIER extends ModelFirebaseCrudFunctionSpecifierDefault ? CRUD : SPECIFIER) : never) : never]: ModelFirebaseCrudFunctionMapEntryFunction<M, SPECIFIER, CRUD>;
};

export declare type ModelFirebaseCrudFunctionMapEntryFunction<E extends unknown | ModelFirebaseCrudFunctionTypeSpecifierConfig, K extends keyof E, CRUD extends string> = E[K] extends ModelFirebaseCrudFunctionTypeMapEntryWithReturnType<infer I, infer O> ? ModelFirebaseCrudFunction<I, O> : CRUD extends 'create' ? ModelFirebaseCreateFunction<E[K]> : ModelFirebaseCrudFunction<E[K]>;
export type ModelFirebaseFunctionMap<M extends FirebaseFunctionTypeMap, C extends ModelFirebaseCrudFunctionTypeMap> = FirebaseFunctionMap<M> & ModelFirebaseCrudFunctionMap<C>;

/**
 * Used for building a FirebaseFunctionMap<M> for a specific Functions instance.
 */
export type ModelFirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseCrudFunctionTypeMap> = (functionsInstance: Functions) => ModelFirebaseFunctionMap<M, U>;

/**
 * Creates a ModelFirebaseFunctionMapFactory for the input config that targets the "callModel" Firebase function.
 *
 * @param configMap
 * @param crudConfigMap
 * @returns
 */
export function callModelFirebaseFunctionMapFactory<M extends FirebaseFunctionTypeMap, U extends ModelFirebaseCrudFunctionTypeMap>(configMap: FirebaseFunctionTypeConfigMap<M>, crudConfigMap: ModelFirebaseCrudFunctionConfigMap<U, FirestoreModelIdentity>): ModelFirebaseFunctionMapFactory<M, U> {
  const functionFactory = firebaseFunctionMapFactory(configMap);

  return (functionsInstance: Functions) => {
    const functionMap: FirebaseFunctionMap<M> = functionFactory(functionsInstance);

    const _callFn = cachedGetter(() => httpsCallable(functionsInstance, CALL_MODEL_APP_FUNCTION_KEY));

    function makeCallFunction(call: string, fn: Getter<HttpsCallable<unknown, unknown>>, modelType: string, specifier?: string) {
      return mapHttpsCallable(fn(), { mapInput: (data) => onCallTypedModelParamsFunction(call)(modelType, data, specifier) }, true);
    }

    function makeCallSpecifiers(call: string, fn: Getter<HttpsCallable<unknown, unknown>>, modelType: string, specifierKeys: string[]): { [key: string]: HttpsCallable<unknown, unknown> } {
      const modelTypeSuffix = capitalizeFirstLetter(modelType);
      const specifiers: Record<string, HttpsCallable<unknown, unknown>> = {};

      specifierKeys.forEach((inputSpecifier) => {
        const specifier = inputSpecifier === MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT ? '' : inputSpecifier;
        const specifierFn = makeCallFunction(call, fn, modelType, inputSpecifier) as HttpsCallable<unknown, unknown>;

        const fullSpecifierName = `${call}${modelTypeSuffix}${capitalizeFirstLetter(specifier)}`;
        specifiers[fullSpecifierName] = specifierFn;

        const shortSpecifierName = lowercaseFirstLetter(specifier) || call;
        specifiers[shortSpecifierName] = specifierFn;
      });

      return specifiers;
    }

    const result = build<ModelFirebaseFunctionMap<M, U>>({
      base: functionMap as unknown as ModelFirebaseFunctionMap<M, U>,
      build: (x) => {
        Object.entries(crudConfigMap).forEach(([modelType, config]) => {
          const modelTypeSuffix = capitalizeFirstLetter(modelType);
          const { included: crudFunctionKeys, excluded: specifiedCallFunctionKeys } = separateValues(config as string[], (x) => x.indexOf(':') === -1);

          const crudFunctions = new Set(crudFunctionKeys);
          const specifiedCallFunctionTuples = specifiedCallFunctionKeys.map((x) => {
            const [crud, functionsSplit] = x.split(':', 2);
            const functions = functionsSplit.split(MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_SPLITTER);
            return [crud, functions] as [string, string[]];
          });

          // check that there isn't a repeat crud key configured, which disallowed configuration and would cause some functions to be ignored
          const encounteredCalls = new Set<string>();

          function assertCallKeyNotEncountered(crud: string) {
            if (encounteredCalls.has(crud)) {
              throw new Error(`Cannot have multiple declarations of the same crud. Found repeat for crud: ${crud}`);
            } else {
              encounteredCalls.add(crud);
            }
          }

          crudFunctions.forEach(assertCallKeyNotEncountered);
          specifiedCallFunctionTuples.forEach(([crud]) => assertCallKeyNotEncountered(crud));

          // build and add the functions
          const specifierFunctions = new Map<string, string[]>(specifiedCallFunctionTuples);

          function addCallFunctions(crud: string, fn: Getter<HttpsCallable<unknown, unknown>>, modelType: string): void {
            let crudFns: unknown;

            if (crudFunctions.has(crud)) {
              crudFns = makeCallFunction(crud, fn, modelType);
            } else if (specifierFunctions.has(crud)) {
              crudFns = makeCallSpecifiers(crud, fn, modelType, specifierFunctions.get(crud) as string[]);
            }

            if (crudFns) {
              (modelTypeCalls as any)[`${crud}${modelTypeSuffix}`] = crudFns;
            }
          }

          const modelTypeCalls = {};

          // add functions for each call type
          addCallFunctions('create', _callFn, modelType);
          addCallFunctions('read', _callFn, modelType);
          addCallFunctions('update', _callFn, modelType);
          addCallFunctions('delete', _callFn, modelType);

          // tslint:disable-next-line
          (x as any)[modelType] = modelTypeCalls;
        });
      }
    });

    return result;
  };
}
