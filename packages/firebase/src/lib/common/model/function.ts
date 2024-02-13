import { type ArrayOrValue, asArray, Building } from '@dereekb/util';
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
  readonly call?: OnCallFunctionType;
  /**
   * Call sub-function specifier.
   */
  readonly specifier?: string;
  /**
   * Call data
   */
  readonly data: T;
}

/**
 * Creates a OnCallTypedModelParams
 *
 * @param modelType
 * @param data
 * @returns
 */
export function onCallTypedModelParams<T>(modelTypeInput: FirestoreModelType | FirestoreModelTypeRef, data: T, specifier?: string, call?: string): OnCallTypedModelParams<T> {
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
}

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

// MARK: Compat
/**
 * Key used on the front-end and backend that refers to a specific function for creating models.
 *
 * @deprecated Replaced by the callModel function.
 */
export const CREATE_MODEL_APP_FUNCTION_KEY = 'createModel';

/**
 * Key used on the front-end and backend that refers to a specific function for reading models.
 *
 * @deprecated Replaced by the callModel function.
 */
export const READ_MODEL_APP_FUNCTION_KEY = 'readModel';

/**
 * Key used on the front-end and backend that refers to a specific function for updating models.
 *
 * @deprecated Replaced by the callModel function.
 */
export const UPDATE_MODEL_APP_FUNCTION_KEY = 'updateModel';

/**
 * Key used on the front-end and backend that refers to a specific function for deleting models.
 *
 * @deprecated Replaced by the callModel function.
 */
export const DELETE_MODEL_APP_FUNCTION_KEY = 'deleteModel';
