import { ArrayOrValue, asArray } from '@dereekb/util';
import { DocumentReferenceRef } from '../firestore/reference';
import { FirestoreModelKey, FirestoreModelType, FirestoreModelTypeRef } from '../firestore/collection/collection';

export interface OnCallTypedModelParams<T = unknown> extends FirestoreModelTypeRef {
  specifier?: string;
  data: T;
}

/**
 * Creates a OnCallTypedModelParams
 *
 * @param modelType
 * @param data
 * @returns
 */
export function onCallTypedModelParams<T>(modelTypeInput: FirestoreModelType | FirestoreModelTypeRef, data: T, specifier?: string): OnCallTypedModelParams<T> {
  const modelType = typeof modelTypeInput === 'string' ? modelTypeInput : modelTypeInput.modelType;

  if (!modelType) {
    throw new Error('modelType is required.');
  }

  const result: OnCallTypedModelParams<T> = {
    modelType,
    data
  };

  if (specifier != null) {
    result.specifier = specifier;
  }

  return result;
}

/**
 * Key used on the front-end and backend that refers to a specific function for creating models.
 */
export const CREATE_MODEL_APP_FUNCTION_KEY = 'createModel';

export type OnCallCreateModelParams<T = unknown> = OnCallTypedModelParams<T>;

/**
 * Key used on the front-end and backend that refers to a specific function for reading models.
 */
export const READ_MODEL_APP_FUNCTION_KEY = 'readModel';

export type OnCallReadModelParams<T = unknown> = OnCallTypedModelParams<T>;

/**
 * Key used on the front-end and backend that refers to a specific function for updating models.
 */
export const UPDATE_MODEL_APP_FUNCTION_KEY = 'updateModel';

export type OnCallUpdateModelParams<T = unknown> = OnCallTypedModelParams<T>;
/**
 * Key used on the front-end and backend that refers to a specific function for deleting models.
 */
export const DELETE_MODEL_APP_FUNCTION_KEY = 'deleteModel';

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
