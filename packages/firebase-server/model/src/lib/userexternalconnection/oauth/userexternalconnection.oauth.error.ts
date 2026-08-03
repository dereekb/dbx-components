import { type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * An error a provider reported on the redirect back, rather than one thrown on our side.
 *
 * Per RFC 6749 4.1.2.1 the authorization server redirects to the `redirect_uri` with these instead
 * of a `code` when it refuses the request. Reading them is what keeps a declined consent or a
 * rejected scope from being misreported as a missing authorization code.
 */
export interface UserExternalConnectionOAuthProviderError {
  /**
   * The OAuth error code, e.g. `invalid_request`, `invalid_scope`, `access_denied`.
   */
  readonly error: string;
  /**
   * The provider's human-readable explanation, when it sent one.
   */
  readonly errorDescription?: Maybe<string>;
}

/**
 * Maps an OAuth refusal reported by a provider to the connection entry's error code.
 *
 * The codes are the standard OAuth 2.0 ones, so this mapping is the same for every provider. A
 * failure thrown on our own side has no provider error and stays `provider_error`.
 *
 * @param providerError - The error the provider reported on the redirect, when it reported one.
 * @returns The error code to record on the connection entry.
 */
export function userExternalConnectionErrorCodeForOAuthProviderError(providerError: Maybe<UserExternalConnectionOAuthProviderError>): UserExternalConnectionErrorCode {
  let result: UserExternalConnectionErrorCode;

  switch (providerError?.error) {
    case 'access_denied':
      // the user declined at the consent screen; nothing is wrong with the integration
      result = 'unauthorized';
      break;
    case 'invalid_scope':
    case 'insufficient_scope':
      result = 'insufficient_scope';
      break;
    default:
      // `invalid_request` covers the scope-exceeds-registration refusal, which is a
      // misconfiguration on our side rather than a provider outage
      result = providerError?.errorDescription?.toLowerCase().includes('scope') ? 'insufficient_scope' : 'provider_error';
      break;
  }

  return result;
}
