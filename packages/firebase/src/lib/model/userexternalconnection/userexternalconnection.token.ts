import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId } from '../../common/auth/auth';
import { type UserExternalConnectionCapability, type UserExternalConnectionProviderType } from './userexternalconnection.id';
import { type UserExternalConnectionProviderData } from './userexternalconnection.data';

// MARK: Paths
/**
 * Path (relative to the API base URL) the external connection token API is mounted under.
 *
 * Sits under the session API's `/session` prefix, so apps already listing `/api/session` in their OIDC
 * `protectedPaths` need no extra entry.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_API_PATH = '/session/external';

/**
 * Returns the path (relative to the API base URL) that mints an access token for one provider.
 *
 * @param providerType - The provider whose access token to mint.
 * @param options - Optional query options, e.g. `includeData`.
 * @returns The path, e.g. `/session/external/zoho_admin`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionTokenApiPath(providerType: UserExternalConnectionProviderType, options?: Maybe<UserExternalConnectionTokenApiPathOptions>): string {
  const path = `${USER_EXTERNAL_CONNECTION_TOKEN_API_PATH}/${encodeURIComponent(providerType)}`;
  return options?.includeData ? `${path}?${USER_EXTERNAL_CONNECTION_TOKEN_INCLUDE_QUERY_PARAM}=${USER_EXTERNAL_CONNECTION_TOKEN_INCLUDE_DATA}` : path;
}

/**
 * Query parameter of the token API that asks for extra content alongside the token (comma-separated values).
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_INCLUDE_QUERY_PARAM = 'include';

/**
 * {@link USER_EXTERNAL_CONNECTION_TOKEN_INCLUDE_QUERY_PARAM} value that adds the caller's stored connection data for the
 * provider to the response.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_INCLUDE_DATA = 'data';

/**
 * Options for {@link userExternalConnectionTokenApiPath}.
 */
export interface UserExternalConnectionTokenApiPathOptions {
  /**
   * Adds `?include=data`, asking for the caller's stored connection data for the provider.
   */
  readonly includeData?: Maybe<boolean>;
}

// MARK: Error Codes
/**
 * Error code thrown when the caller may not mint external connection access tokens at all: the app's
 * predicate refused them, the caller is not an OIDC client, or its OIDC client is not allowlisted.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR';

/**
 * Error code thrown when the requested provider's access token may not be minted out — the app did not
 * opt the provider in through its `tokenExport` policy.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR';

/**
 * Error code (403) thrown when the caller's scope ceiling does not allow minting the connection's token. This happens when:
 * - the connection's grant reaches past the ceiling (data `{ providerType, excessScopes }`);
 * - the grant is unknown (data `{ providerType }`);
 * - the caller holds none of the OIDC scopes the provider's ceiling config maps (data `{ providerType }`).
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR';

// MARK: Response
/**
 * A short-lived access token for one of the caller's own external connections, minted out by the
 * external connection token API.
 *
 * Carries only what a client needs to call the provider: never the refresh token, and only the `extra`
 * values the provider adapter allowlists (e.g. the api domain a Zoho token is valid against).
 */
export interface UserExternalConnectionAccessToken {
  /**
   * The uid the token belongs to — always the caller's.
   */
  readonly uid: FirebaseAuthUserId;
  readonly providerType: UserExternalConnectionProviderType;
  readonly accessToken: string;
  readonly tokenType?: Maybe<string>;
  /**
   * The scopes the connection was granted.
   */
  readonly scopes?: Maybe<UserExternalConnectionCapability[]>;
  /**
   * When the access token expires. A client should mint again rather than use it past this.
   */
  readonly expiresAt?: Maybe<ISO8601DateString>;
  /**
   * Non-secret provider values the token is only usable alongside.
   */
  readonly extra?: Maybe<Record<string, Maybe<string | number | boolean>>>;
}

/**
 * The token API's response: the access token, plus the caller's stored connection data for the provider when asked
 * for with `?include=data`.
 */
export interface UserExternalConnectionAccessTokenResponse extends UserExternalConnectionAccessToken {
  /**
   * The caller's stored data for THIS provider only. Present only with `?include=data`, when the app wired connection
   * data and some exists.
   */
  readonly data?: Maybe<UserExternalConnectionProviderData>;
}
