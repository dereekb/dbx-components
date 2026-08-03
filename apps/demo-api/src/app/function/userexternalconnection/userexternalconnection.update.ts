import { type DisconnectUserExternalConnectionParams, disconnectUserExternalConnectionParamsType, firestoreModelKey, userExternalConnectionIdentity } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoUpdateModelFunction } from '../function.context';

/**
 * Disconnects the calling user from a third-party provider.
 *
 * This is the only client-reachable write on the connection pair. It removes the provider's
 * credentials and its public entry in a single transaction, and recomputes the connected-provider
 * array from the result.
 *
 * The target is always the caller's own pair: it is keyed by uid, so the key is built here rather
 * than taken from `key` (which the client's document store injects, but which cannot name anything
 * else the caller could act on). The `disconnect` role is still asserted against that document so
 * the model's permission map — not this function — decides whether the write is allowed.
 */
export const userExternalConnectionUpdateDisconnect: DemoUpdateModelFunction<DisconnectUserExternalConnectionParams> = withApiDetails({
  inputType: disconnectUserExternalConnectionParamsType,
  fn: async (request) => {
    const { nest, data, auth } = request;
    const uid = auth.uid;

    await nest.useModel('userExternalConnection', {
      request,
      key: firestoreModelKey(userExternalConnectionIdentity, uid),
      roles: 'disconnect',
      use: () => nest.userExternalConnectionActions.disconnectUserExternalConnection({ uid, providerType: data.providerType })
    });
  }
});
