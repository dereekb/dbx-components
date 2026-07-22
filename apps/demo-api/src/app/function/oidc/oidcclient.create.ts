import { firestoreModelKey, type CreateOidcClientParams, type CreateOidcClientResult, type FirebaseAuthOwnershipKey, createOidcClientParamsType } from '@dereekb/firebase';
import { type DemoCreateModelFunction } from '../function.context';
import { isAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { profileIdentity } from 'demo-firebase';

export const oidcEntryCreateClient: DemoCreateModelFunction<CreateOidcClientParams, CreateOidcClientResult> = withApiDetails({
  inputType: createOidcClientParamsType,
  analytics: {
    onSuccess: (analytics, request, result) => {
      analytics.sendEvent('OIDC Client Created', { client_id: result?.client_id });
    },
    onError: (analytics) => {
      analytics.sendEventType('OIDC Client Create Failed');
    }
  },
  fn: async (request) => {
    const { nest, data } = request;
    const isAdmin = isAdminInRequest(request);
    let key: FirebaseAuthOwnershipKey | undefined;

    if (!isAdmin) {
      key = undefined;
    }

    // default to the current user, otherwise they will not be able to read/modify the client
    if (!key) {
      key = firestoreModelKey(profileIdentity, request.auth.uid);
    }

    // Provider profile assignment is admin-only; strip it from a non-admin's request so it is ignored.
    const params: CreateOidcClientParams = isAdmin ? { ...data, key } : { ...data, key, dbx_provider_profiles: undefined };

    const createFn = await nest.oidcModelServerActions.createOidcClient(params);
    return createFn();
  }
});
