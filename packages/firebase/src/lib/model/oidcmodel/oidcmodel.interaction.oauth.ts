import { type Maybe, type SpaceSeparatedString, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { type FirebaseAuthIdToken } from '../../common/auth/auth';
import { type OidcEntryClientId } from './oidcmodel.id';
import { type OidcScope } from './oidcmodel.interaction';

/**
 * Request body sent by the frontend to complete a login interaction.
 *
 * Posted to `POST /interaction/:uid/login` by the frontend after
 * the user authenticates via Firebase.
 */
export interface OAuthInteractionLoginRequest {
  /**
   * Firebase Auth ID token.
   *
   * The backend verifies this token via `admin.auth().verifyIdToken()` and
   * uses the decoded UID as the `accountId` for the oidc-provider login result.
   */
  readonly idToken: FirebaseAuthIdToken;
}

/**
 * Space-separated string of scopes requested by the client.
 */
export type OAuthInteractionScopes<T extends OidcScope = OidcScope> = SpaceSeparatedString<T>;

/**
 * Details about oauth client and interaction.
 */
export interface OAuthInteractionLoginDetails<T extends OidcScope = OidcScope> {
  readonly client_id: OidcEntryClientId;
  readonly client_name?: Maybe<string>;
  readonly logo_uri?: Maybe<string>;
  readonly client_uri?: Maybe<string>;
  readonly scopes: OAuthInteractionScopes<T>;
}

/**
 * Response from the server after a successful interaction submission.
 *
 * The server returns a redirect URL that the client should navigate to
 * in order to complete the OIDC flow.
 */
export interface OAuthInteractionLoginResponse {
  readonly redirectTo: WebsiteUrlWithPrefix;
}

/**
 * Request body sent by the frontend to complete a consent interaction.
 *
 * Posted to `POST /interaction/:uid/consent` by the frontend after
 * the user approves or denies the requested scopes/claims.
 */
export interface OAuthInteractionConsentRequest {
  /**
   * Firebase Auth ID token.
   *
   * The backend verifies this token to confirm the caller is the
   * same user who completed the login interaction.
   */
  readonly idToken: FirebaseAuthIdToken;
  /**
   * Whether the user approved the consent.
   *
   * When `true`, the backend grants missing scopes/claims and completes the interaction.
   * When `false`, the backend returns `access_denied` to the OAuth client.
   */
  readonly approved: boolean;
  /**
   * Optional subset of OIDC scopes to grant. Each value must be in either
   * `prompt.details.missingOIDCScope` or already encountered on the
   * existing Grant (granted or rejected previously). Values not in
   * either set return `400 BAD_REQUEST`.
   *
   * Already-encountered values are accepted as silent no-ops, which lets a
   * `prompt=consent` re-display submit the full requested scope set from
   * the auth URL without rejection when the user has previously authorized
   * the client.
   *
   * `openid` is always added by the server when it was requested,
   * regardless of whether it appears here. When omitted, every
   * missing OIDC scope is granted (back-compat with the all-or-nothing flow).
   */
  readonly grantedOIDCScopes?: readonly OidcScope[];
  /**
   * Optional subset of OIDC claims to grant. Each value must be in either
   * `prompt.details.missingOIDCClaims` or already encountered on the
   * existing Grant. Values in neither return `400 BAD_REQUEST`.
   * When omitted, every missing claim is granted.
   */
  readonly grantedOIDCClaims?: readonly string[];
  /**
   * Optional subset of resource scopes to grant per resource indicator.
   * Each entry's array values must be in either the corresponding entry in
   * `prompt.details.missingResourceScopes` or already encountered on the
   * existing Grant for that indicator. Values in neither return `400 BAD_REQUEST`.
   * When omitted, every missing resource scope is granted. When an
   * indicator is omitted, that indicator's resource scopes are granted in full.
   */
  readonly grantedResourceScopes?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Response from the server after a successful interaction submission.
 *
 * The server returns a redirect URL that the client should navigate to
 * in order to complete the OIDC flow.
 */
export interface OAuthInteractionConsentResponse {
  readonly redirectTo: WebsiteUrlWithPrefix;
}
