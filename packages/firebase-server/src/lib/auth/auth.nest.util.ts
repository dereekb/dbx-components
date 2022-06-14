import { UserRelated } from '@dereekb/firebase';
import { forbiddenError } from '../function';
import { NestContextCallableRequestWithAuth } from '../nest/function/nest';
import { AbstractFirebaseNestContext } from '../nest/nest.provider';

export function assertIsAdminInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithAuth<N, I>) {
  if (!isAdminInRequest(request)) {
    throw forbiddenError();
  }
}

export function isAdminInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithAuth<N, I>) {
  return request.nest.authService.context(request).isAdmin;
}

export function assertIsAdminOrTargetUserInRequestData<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I extends Partial<UserRelated> = Partial<UserRelated>>(request: NestContextCallableRequestWithAuth<N, I>, requireUid?: boolean) {
  if (!isAdminOrTargetUserInRequestData(request, requireUid)) {
    throw forbiddenError();
  }

  return request.data.uid ?? request.auth.uid;
}

export function isAdminOrTargetUserInRequestData<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I extends Partial<UserRelated> = Partial<UserRelated>>(request: NestContextCallableRequestWithAuth<N, I>, requireUid = false) {
  const uid = request.data.uid;
  const authUid = request.auth.uid;

  let isAdminOrTargetUser = true;

  if ((requireUid && uid == null) || (uid != null && uid !== authUid)) {
    isAdminOrTargetUser = request.nest.authService.context(request).isAdmin;
  }

  return isAdminOrTargetUser;
}
