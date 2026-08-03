import { type ReadUserExternalConnectionAuthorizeStateParams, type UserExternalConnectionAuthorizeStateResult, type UserExternalConnectionProviderType, readUserExternalConnectionAuthorizeStateParamsType } from '@dereekb/firebase';
import { preconditionConflictError, withApiDetails } from '@dereekb/firebase-server';
import { DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE } from 'demo-firebase';
import { type DemoReadModelFunction } from '../function.context';
import { userExternalConnectionUidForRequest } from './userexternalconnection.util';

/**
 * The providers this app has an OAuth authorize/callback flow wired for.
 *
 * A provider absent from this set has no endpoint to send the user to, so minting a state for it
 * would hand back something unusable.
 */
export const DEMO_EXTERNAL_CONNECTION_AUTHORIZE_PROVIDER_TYPES: ReadonlySet<UserExternalConnectionProviderType> = new Set([DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE]);

/**
 * Raised when a client asks to connect a provider the app has no OAuth handoff wired for.
 *
 * @param providerType - The unsupported provider type.
 * @returns The error to throw.
 */
export function userExternalConnectionProviderHasNoAuthorizeFlowError(providerType: UserExternalConnectionProviderType) {
  return preconditionConflictError(`The provider "${providerType}" has no OAuth authorize flow configured.`);
}

/**
 * Mints the short-lived `state` that begins a provider's OAuth connect handoff.
 *
 * The state is what lets the provider's redirect back to us be attributed to a user: the authorize
 * request is a top-level browser navigation and carries no credentials of its own. Minting it here,
 * on an authenticated call, is why the client never needs to put its ID token on the redirect.
 */
export const userExternalConnectionReadAuthorizeState: DemoReadModelFunction<ReadUserExternalConnectionAuthorizeStateParams, UserExternalConnectionAuthorizeStateResult> = withApiDetails({
  inputType: readUserExternalConnectionAuthorizeStateParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const { providerType } = data;

    if (!DEMO_EXTERNAL_CONNECTION_AUTHORIZE_PROVIDER_TYPES.has(providerType)) {
      throw userExternalConnectionProviderHasNoAuthorizeFlowError(providerType);
    }

    const uid = await userExternalConnectionUidForRequest(request);
    const state = nest.userExternalConnectionStateCoder.mintState({ uid, providerType });

    return { state };
  }
});
