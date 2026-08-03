import { type FirebaseAuthUserId, type InferredTargetModelParams, type TargetModelParams } from '@dereekb/firebase';
import { type NestContextCallableRequestWithAuth } from '@dereekb/firebase-server';
import { type DemoApiNestContext } from '../function.context';

/**
 * Resolves the uid whose UserExternalConnection pair a callable request targets.
 *
 * A UserExternalConnection document's id IS the user's uid, so when no explicit key is supplied the
 * caller's own uid is used. An explicit key is resolved through the model service, which only grants
 * `update` when the caller is the related user.
 *
 * @param request - The authenticated callable request.
 * @returns The uid of the targeted connection pair.
 */
export async function userExternalConnectionUidForRequest(request: NestContextCallableRequestWithAuth<DemoApiNestContext, TargetModelParams | InferredTargetModelParams>): Promise<FirebaseAuthUserId> {
  const { nest, data: params, auth } = request;
  let uid: FirebaseAuthUserId;

  if (params.key == null) {
    uid = auth.uid;
  } else {
    uid = await nest.useModel('userExternalConnection', {
      request,
      key: params.key,
      roles: 'update',
      use: (x) => x.document.id
    });
  }

  return uid;
}
