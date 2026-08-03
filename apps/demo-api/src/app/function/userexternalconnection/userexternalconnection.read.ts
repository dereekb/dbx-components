import { type ReadUserExternalConnectionAuthorizeStateParams, type UserExternalConnectionAuthorizeStateResult, firestoreModelKey, readUserExternalConnectionAuthorizeStateParamsType, userExternalConnectionIdentity } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoReadModelFunction } from '../function.context';

/**
 * Mints the short-lived `state` that begins a provider's OAuth connect handoff.
 *
 * The state is what lets the provider's redirect back to us be attributed to a user: the authorize
 * request is a top-level browser navigation and carries no credentials of its own. Minting it here,
 * on an authenticated call, is why the client never needs to put its ID token on the redirect.
 *
 * Which providers are offered comes from the registry of mounted OAuth services rather than a list
 * maintained here, so a provider absent from the app's modules cannot be handed an unusable state.
 *
 * The state is always minted for the caller's own document: it is keyed by uid, so the key is built
 * here rather than taken from `key` (which the client's document store injects, but which cannot name
 * anything else the caller could act on). The `connect` role is asserted against that document, which
 * therefore has to exist — a user creates it before connecting anything.
 */
export const userExternalConnectionReadAuthorizeState: DemoReadModelFunction<ReadUserExternalConnectionAuthorizeStateParams, UserExternalConnectionAuthorizeStateResult> = withApiDetails({
  inputType: readUserExternalConnectionAuthorizeStateParamsType,
  fn: async (request) => {
    const { nest, data, auth } = request;
    const { providerType } = data;

    nest.userExternalConnectionOAuthRegistry.assertHasAuthorizeFlowForProviderType(providerType);

    const uid = auth.uid;

    return nest.useModel('userExternalConnection', {
      request,
      key: firestoreModelKey(userExternalConnectionIdentity, uid),
      roles: 'connect',
      use: () => ({ state: nest.userExternalConnectionStateCoder.mintState({ uid, providerType }) })
    });
  }
});
