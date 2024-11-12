import { type ArrayOrValue, asArray, type Building, Maybe } from '@dereekb/util';
import { type DocumentReferenceRef } from '../firestore/reference';
import { type FirestoreModelKey, type FirestoreModelType, type FirestoreModelTypeRef } from '../firestore/collection/collection';

/**
 * Set of known call types. The basic CRUD functions.
 */
export type KnownOnCallFunctionType = 'create' | 'read' | 'update' | 'delete';

/**
 * A call function type specifier.
 */
export type OnCallFunctionType = KnownOnCallFunctionType | string;

export interface OnCallTypedModelParams<T = unknown> extends FirestoreModelTypeRef {
  /**
   * Call type. Should typically be defined.
   */
  readonly call?: Maybe<OnCallFunctionType>;
  /**
   * Call sub-function specifier.
   */
  readonly specifier?: Maybe<string>;
  /**
   * Call data
   */
  readonly data: T;
}

/**
 *
 */
export type OnCallTypeModelParamsFunction = <T>(modelTypeInput: FirestoreModelType | FirestoreModelTypeRef, data: T, specifier?: string) => OnCallTypedModelParams<T>;

/**
 * Creates a OnCallTypedModelParamsFunction
 *
 * @param call
 * @returns
 */
export function onCallTypedModelParamsFunction(call?: Maybe<OnCallFunctionType>): OnCallTypeModelParamsFunction {
  return <T>(modelTypeInput: FirestoreModelType | FirestoreModelTypeRef, data: T, specifier?: string) => {
    const modelType = typeof modelTypeInput === 'string' ? modelTypeInput : modelTypeInput.modelType;

    if (!modelType) {
      throw new Error('modelType is required.');
    }

    const result: OnCallTypedModelParams<T> = {
      call,
      modelType,
      data
    };

    if (specifier != null) {
      (result as Building<OnCallCreateModelParams<T>>).specifier = specifier;
    }

    return result;
  };
}

/**
 * Creates OnCallTypedModelParams for the input.
 *
 * Convenience function for calling onCallTypedModelParamsFunction and executing it with the input.
 *
 * @deprecated Move towards using onCallTypedModelParamsFunction directly with the call type instead of using this function. Will not be removed in the future.
 *
 * @param modelType
 * @param data
 * @returns
 */
export function onCallTypedModelParams<T>(modelTypeInput: FirestoreModelType | FirestoreModelTypeRef, data: T, specifier?: string, call?: OnCallFunctionType): OnCallTypedModelParams<T> {
  return onCallTypedModelParamsFunction(call)(modelTypeInput, data, specifier);
}

/**
 * Pre-configured OnCallTypedModelParamsFunctions for 'create'
 */
export const onCallCreateModelParams = onCallTypedModelParamsFunction('create');

/**
 * Pre-configured OnCallTypedModelParamsFunctions for 'read'
 */
export const onCallReadModelParams = onCallTypedModelParamsFunction('read');

/**
 * Pre-configured OnCallTypedModelParamsFunctions for 'update'
 */
export const onCallUpdateModelParams = onCallTypedModelParamsFunction('update');

/**
 * Pre-configured OnCallTypedModelParamsFunctions for 'delete'
 */
export const onCallDeleteModelParams = onCallTypedModelParamsFunction('delete');

/**
 * Key used on the front-end and backend that refers to the call function.
 */
export const CALL_MODEL_APP_FUNCTION_KEY = 'callModel';

/**
 * OnCallTypedModelParams for Create calls.
 */
export type OnCallCreateModelParams<T = unknown> = OnCallTypedModelParams<T>;

/**
 * OnCallTypedModelParams for Read calls.
 */
export type OnCallReadModelParams<T = unknown> = OnCallTypedModelParams<T>;

/**
 * OnCallTypedModelParams for Update calls.
 */
export type OnCallUpdateModelParams<T = unknown> = OnCallTypedModelParams<T>;

/**
 * OnCallTypedModelParams for Delete calls.
 */
export type OnCallDeleteModelParams<T = unknown> = OnCallTypedModelParams<T>;

// MARK: Result
export interface OnCallCreateModelResult {
  /**
   * Key(s)/Paths of the created object(s)
   */
  modelKeys: ArrayOrValue<FirestoreModelKey>;
}

export function onCallCreateModelResultWithDocs(result: ArrayOrValue<DocumentReferenceRef<unknown>>): OnCallCreateModelResult {
  return onCallCreateModelResult(asArray(result).map((x) => x.documentRef.path));
}

export function onCallCreateModelResult(modelKeys: ArrayOrValue<FirestoreModelKey>): OnCallCreateModelResult {
  return {
    modelKeys: asArray(modelKeys)
  };
}
