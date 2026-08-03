import { type ReadUserExternalConnectionAuthorizeStateParams, type UserExternalConnectionAuthorizeStateResult, readUserExternalConnectionAuthorizeStateParamsType } from '@dereekb/firebase';
import { preconditionConflictError, withApiDetails } from '@dereekb/firebase-server';
import { DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE } from 'demo-firebase';
import { type DemoReadModelFunction } from '../function.context';
import { userExternalConnectionUidForRequest } from './userexternalconnection.util';

/**
 * Raised when a client asks to connect a provider the app has no OAuth handoff wired for.
 *
 * @param providerType - The unsupported provider type.
 * @returns The error to throw.
 */
export function userExternalConnectionProviderHasNoAuthorizeFlowError(providerType: string) {
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
    const uid = await userExternalConnectionUidForRequest(request);
    let state: string;

    switch (providerType) {
      case DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE:
        state = nest.calcomOAuthService.mintState(uid);
        break;
      default:
        throw userExternalConnectionProviderHasNoAuthorizeFlowError(providerType);
    }

    return { state };
  }
});
