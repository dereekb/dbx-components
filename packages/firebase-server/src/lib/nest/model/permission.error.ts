import { FirebaseContextGrantedModelRoles, FirebasePermissionErrorContext, FirebasePermissionErrorContextErrorFunction } from '@dereekb/firebase';
import { ArrayOrValue, serverError } from '@dereekb/util';
import { GrantedRole } from '@dereekb/model';
import { forbiddenError } from '../../function/error';

export const nestFirebaseForbiddenPermissionError: FirebasePermissionErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, roles?: ArrayOrValue<GrantedRole>) => {
  return forbiddenError(
    serverError({
      status: 403,
      code: 'PERMISSION_ERROR',
      message: 'You do not have permission to do this.',
      data: {
        id: firebaseContextGrantedModelRoles.data?.document.id,
        type: firebaseContextGrantedModelRoles.data?.document.modelType,
        roles
      }
    })
  );
};
