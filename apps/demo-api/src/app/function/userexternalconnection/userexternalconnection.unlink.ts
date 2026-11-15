import { type UnlinkUserExternalConnectionLoginParams, unlinkUserExternalConnectionLoginParamsType, firestoreModelKey, userExternalConnectionIdentity } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoUpdateModelFunction } from '../function.context';

/**
 * Removes a provider as a login method for the calling user.
 *
 * Strictly more than a disconnect, which is why it is a separate call with a separate role: it removes
 * the provider's login link AND its data connection and credentials in one transaction. A disconnect
 * says "stop using my token"; this says "this account is no longer mine", and one cannot leave a live
 * connection to an account the user has disowned.
 *
 * Refused server-side when it would leave the account with no way to sign back in.
 *
 * The target is always the caller's own pair, built here from their uid: the params take no `key`, and one
 * sent anyway fails validation, admins included.
 */
export const userExternalConnectionUpdateUnlink: DemoUpdateModelFunction<UnlinkUserExternalConnectionLoginParams> = withApiDetails({
  inputType: unlinkUserExternalConnectionLoginParamsType,
  fn: async (request) => {
    const { nest, data, auth } = request;
    const uid = auth.uid;

    await nest.useModel('userExternalConnection', {
      request,
      key: firestoreModelKey(userExternalConnectionIdentity, uid),
      roles: 'unlink',
      use: () => nest.userExternalConnectionActions.unlinkUserExternalConnectionLogin({ uid, providerType: data.providerType })
    });
  }
});
