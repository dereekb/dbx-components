import { FirestoreCollectionNameRef } from '../firestore/collection/collection';

/**
 * Key used on the front-end and backend that refers to a specific model for updating.
 */
export const UPDATE_MODEL_APP_FUNCTION_KEY = 'updateModel';

export interface OnCallUpdateModelParams<T = unknown> extends FirestoreCollectionNameRef {
  data: T;
}
