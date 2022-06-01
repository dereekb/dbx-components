import { FirebaseContextGrantedModelRoles, FirebasePermissionErrorContext, FirebasePermissionErrorContextErrorFunction } from '@dereekb/firebase';
import { serverError } from '@dereekb/util';
import { ForbiddenException } from '@nestjs/common';

export const makeNestFirebaseForbiddenPermissionError: FirebasePermissionErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, role?: string) => {
  return new ForbiddenException(
    serverError({
      status: 403,
      code: 'PERMISSION_ERROR',
      message: 'You do not have permission to do this.',
      data: {
        id: firebaseContextGrantedModelRoles.data?.document.id,
        type: firebaseContextGrantedModelRoles.data?.document.modelType,
        role
      }
    })
  );
};
