import { type FirebaseAuthIdToken } from '../../common/auth/auth';

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
