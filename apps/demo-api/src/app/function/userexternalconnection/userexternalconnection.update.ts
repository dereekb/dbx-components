import { type DisconnectUserExternalConnectionParams, disconnectUserExternalConnectionParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoUpdateModelFunction } from '../function.context';
import { userExternalConnectionUidForRequest } from './userexternalconnection.util';

/**
 * Disconnects the target user from a third-party provider.
 *
 * This is the only client-reachable write on the connection pair. It removes the provider's
 * credentials and its public entry in a single transaction, and recomputes the connected-provider
 * array from the result.
 */
export const userExternalConnectionUpdateDisconnect: DemoUpdateModelFunction<DisconnectUserExternalConnectionParams> = withApiDetails({
  inputType: disconnectUserExternalConnectionParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const uid = await userExternalConnectionUidForRequest(request);
    await nest.userExternalConnectionActions.disconnectUserExternalConnection({ uid, providerType: data.providerType });
  }
});
