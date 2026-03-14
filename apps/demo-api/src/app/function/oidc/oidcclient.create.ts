import { firestoreModelKey, type CreateOidcClientParams, type CreateOidcClientResult, type FirebaseAuthOwnershipKey } from '@dereekb/firebase';
import { type DemoCreateModelFunction } from '../function.context';
import { isAdminInRequest } from '@dereekb/firebase-server';
import { profileIdentity } from 'demo-firebase';

export const createOidcClient: DemoCreateModelFunction<CreateOidcClientParams, CreateOidcClientResult> = async (request) => {
  const { nest, data } = request;
  let key: FirebaseAuthOwnershipKey | undefined;

  if (!isAdminInRequest(request)) {
    key = undefined;
  }

  // default to the current user, otherwise they will not be able to read/modify the client
  if (!key) {
    key = firestoreModelKey(profileIdentity, request.auth.uid);
  }

  const createFn = await nest.oidcModelServerActions.createOidcClient({ ...data, key });
  return createFn();
};
