import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId } from '../../common/auth/auth';
import { type UserExternalConnectionCapability, type UserExternalConnectionProviderType } from './userexternalconnection.id';
import { type UserExternalConnectionScopePresetKey } from './userexternalconnection.preset';

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
 * @returns The path, e.g. `/session/external/zoho_admin`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionTokenApiPath(providerType: UserExternalConnectionProviderType): string {
  return `${USER_EXTERNAL_CONNECTION_TOKEN_API_PATH}/${encodeURIComponent(providerType)}`;
}

/**
 * Query parameter on the token mint path that narrows the minted token to a subset of scopes.
 *
 * Space-delimited (commas are also accepted). It can only narrow: every requested scope must sit
 * inside the caller's ceiling (see the server's `providerScopes` config) and inside what the
 * connection was granted. A present-but-empty value is refused.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_QUERY_PARAM = 'scopes';

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
 * Error code (403) thrown when the mint asks for scopes above the caller's ceiling — the requested
 * `scopes` reach outside what the caller's OIDC scopes allow — or when the caller holds none of the
 * OIDC scopes the provider's ceiling config maps.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR';

/**
 * Error code (403) thrown when the mint asks for scopes the connection was not granted. The user has
 * to reconnect with a wider scope preset; the error data names it.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_NOT_GRANTED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_NOT_GRANTED_ERROR';

/**
 * Error code (400) thrown when the `scopes` query parameter is present but empty or unparseable.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR';

/**
 * Error code (400) thrown when the mint asks for explicit `scopes` but the provider cannot mint a
 * narrowed access token (e.g. Zoho, Microsoft).
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR';

/**
 * Data carried by a {@link USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_NOT_GRANTED_ERROR_CODE} error.
 */
export interface UserExternalConnectionTokenScopeNotGrantedErrorData {
  /**
   * The requested scopes the connection was not granted.
   */
  readonly missingScopes: UserExternalConnectionCapability[];
  /**
   * The smallest scope preset that covers the request, if any — the one to reconnect with.
   */
  readonly reconnectScopePreset?: Maybe<UserExternalConnectionScopePresetReference>;
}

/**
 * The key and label of a scope preset, as named in an error.
 */
export interface UserExternalConnectionScopePresetReference {
  readonly key: UserExternalConnectionScopePresetKey;
  readonly label: string;
}

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
   * The scopes the access token carries.
   *
   * When the mint narrowed the token (a provider that supports narrowing, with a ceiling or requested
   * `scopes`), this is the narrowed set. Otherwise it is the set the connection was granted.
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
