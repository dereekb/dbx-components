import { firestoreModelKey, type CreateOidcClientParams, type CreateOidcClientResult, type FirebaseAuthOwnershipKey, createOidcClientParamsType } from '@dereekb/firebase';
import { withApiDetails, isAdminInRequest } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { type APP_CODE_PREFIXCreateModelFunction } from '../function';
import { profileIdentity } from 'FIREBASE_COMPONENTS_NAME';

export const oidcEntryCreateClient: APP_CODE_PREFIXCreateModelFunction<CreateOidcClientParams, CreateOidcClientResult> = withApiDetails({
  inputType: createOidcClientParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    let key: Maybe<FirebaseAuthOwnershipKey>;

    if (!isAdminInRequest(request)) {
      key = undefined;
    }

    // default to the current user, otherwise they will not be able to read/modify the client
    if (!key) {
      key = firestoreModelKey(profileIdentity, request.auth.uid);
    }

    const createFn = await nest.oidcModelServerActions.createOidcClient({ ...data, key });
    return createFn();
  }
});
