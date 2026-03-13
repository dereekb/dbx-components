import { OidcInteractionUid } from './oidcmodel.interaction';

/**
 * Request body sent by the frontend to complete a login interaction.
 *
 * Posted to `POST /interaction/:uid/login` by the frontend after
 * the user authenticates via Firebase. The backend verifies the
 * ID token and extracts the account ID to pass to `provider.interactionFinished()`.
 */
export interface OAuthInteractionLoginRequest {
  /**
   * Firebase ID token as proof of authentication.
   *
   * The backend verifies this token and extracts the user's UID
   * to set as the `accountId` on the oidc-provider login result.
   */
  readonly idToken: OidcInteractionUid;
}

/**
 * Request body sent by the frontend to complete a consent interaction.
 *
 * Posted to `POST /interaction/:uid/consent` by the frontend after
 * the user approves or denies the requested scopes/claims.
 */
export interface OAuthInteractionConsentRequest {
  /**
   * Whether the user approved the consent.
   *
   * When `true`, the backend grants missing scopes/claims and completes the interaction.
   * When `false`, the backend returns `access_denied` to the OAuth client.
   */
  readonly approved: boolean;
}
