import { FirebaseContextGrantedModelRoles, FirebaseDoesNotExistErrorContextErrorFunction, FirebasePermissionErrorContext, FirebasePermissionErrorContextErrorFunction } from '@dereekb/firebase';
import { ArrayOrValue } from '@dereekb/util';
import { GrantedRole } from '@dereekb/model';
import { forbiddenError, modelNotAvailableError } from '../../function/error';

export const nestFirebaseDoesNotExistError: FirebaseDoesNotExistErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>) => {
  return modelNotAvailableError({
    data: {
      id: firebaseContextGrantedModelRoles.data?.document.key,
      type: firebaseContextGrantedModelRoles.data?.document.modelType
    }
  });
};

export const nestFirebaseForbiddenPermissionError: FirebasePermissionErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, roles?: ArrayOrValue<GrantedRole>) => {
  return forbiddenError({
    data: {
      id: firebaseContextGrantedModelRoles.data?.document.key,
      type: firebaseContextGrantedModelRoles.data?.document.modelType,
      roles
    }
  });
};
