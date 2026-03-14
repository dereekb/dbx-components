import { type FirebaseContextGrantedModelRoles, type FirebaseDoesNotExistErrorContextErrorFunction, type FirebasePermissionErrorContext, type FirebasePermissionErrorContextErrorFunction } from '@dereekb/firebase';
import { type ArrayOrValue } from '@dereekb/util';
import { type GrantedRole } from '@dereekb/model';
import { forbiddenError, modelNotAvailableError } from '../../function/error';

/**
 * NestJS-compatible error factory for when a Firestore document does not exist.
 *
 * Returns a "model not available" HTTP error including the document key and model type,
 * which the client can use to display a meaningful "not found" message. Intended to be
 * passed to Firebase permission/existence checking utilities as the
 * {@link FirebaseDoesNotExistErrorContextErrorFunction} callback.
 */
export const nestFirebaseDoesNotExistError: FirebaseDoesNotExistErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>) => {
  return modelNotAvailableError({
    data: {
      id: firebaseContextGrantedModelRoles.data?.document.key,
      type: firebaseContextGrantedModelRoles.data?.document.modelType
    }
  });
};

/**
 * NestJS-compatible error factory for when the caller lacks required roles on a Firestore document.
 *
 * Returns a "forbidden" HTTP error including the document key, model type, and the roles
 * that were required but not granted. Intended to be passed to Firebase permission checking
 * utilities as the {@link FirebasePermissionErrorContextErrorFunction} callback.
 */
export const nestFirebaseForbiddenPermissionError: FirebasePermissionErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, roles?: ArrayOrValue<GrantedRole>) => {
  return forbiddenError({
    data: {
      id: firebaseContextGrantedModelRoles.data?.document.key,
      type: firebaseContextGrantedModelRoles.data?.document.modelType,
      roles
    }
  });
};
