import { FirestoreModelNameRef } from '../firestore/collection/collection';

/**
 * Key used on the front-end and backend that refers to a specific function for updating models.
 */
export const UPDATE_MODEL_APP_FUNCTION_KEY = 'updateModel';

export interface OnCallUpdateModelParams<T = unknown> extends FirestoreModelNameRef {
  data: T;
}

/**
 * Key used on the front-end and backend that refers to aspecific function for deleting models.
 */
export const DELETE_MODEL_APP_FUNCTION_KEY = 'deleteModel';

export interface OnCallDeleteModelParams<T = unknown> extends FirestoreModelNameRef {
  data: T;
}
