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
