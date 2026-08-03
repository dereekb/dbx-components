import { type ReadUserExternalConnectionAuthorizeStateParams, type UserExternalConnectionAuthorizeStateResult, readUserExternalConnectionAuthorizeStateParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoReadModelFunction } from '../function.context';
import { userExternalConnectionUidForRequest } from './userexternalconnection.util';

/**
 * Mints the short-lived `state` that begins a provider's OAuth connect handoff.
 *
 * The state is what lets the provider's redirect back to us be attributed to a user: the authorize
 * request is a top-level browser navigation and carries no credentials of its own. Minting it here,
 * on an authenticated call, is why the client never needs to put its ID token on the redirect.
 *
 * Which providers are offered comes from the registry of mounted OAuth services rather than a list
 * maintained here, so a provider absent from the app's modules cannot be handed an unusable state.
 */
export const userExternalConnectionReadAuthorizeState: DemoReadModelFunction<ReadUserExternalConnectionAuthorizeStateParams, UserExternalConnectionAuthorizeStateResult> = withApiDetails({
  inputType: readUserExternalConnectionAuthorizeStateParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const { providerType } = data;

    nest.userExternalConnectionOAuthRegistry.assertHasAuthorizeFlowForProviderType(providerType);

    const uid = await userExternalConnectionUidForRequest(request);
    const state = nest.userExternalConnectionStateCoder.mintState({ uid, providerType });

    return { state };
  }
});
