import { type FirebaseServerAuthData, type FirebaseServerAuthenticatedRequest } from '@dereekb/firebase-server';

// MARK: Types
/**
 * Auth data attached to the request after successful OIDC bearer token verification.
 *
 * Extends {@link FirebaseServerAuthData} so it is compatible with the server auth pipeline.
 * The `accessToken` field carries OIDC-specific claims from the verified access token.
 */
export interface OidcAuthData extends FirebaseServerAuthData {
  /**
   * Claims from the verified OIDC access token.
   */
  readonly oidcValidatedToken: {
    readonly sub: string;
    readonly scope?: string;
    readonly client_id?: string;
    [key: string]: unknown;
  };
}

/**
 * Extends {@link FirebaseServerAuthenticatedRequest} with OIDC auth data.
 *
 * The `auth` field is populated by {@link OidcAuthBearerTokenMiddleware} after
 * successful bearer token verification.
 */
export interface OidcAuthenticatedRequest extends FirebaseServerAuthenticatedRequest<OidcAuthData> {}
