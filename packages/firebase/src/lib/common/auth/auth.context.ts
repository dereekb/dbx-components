import { AuthClaims, AuthRoleSet, Maybe } from '@dereekb/util';
import { FirebaseAuthToken } from './auth';

/**
 * Provides a context containing FirebaseAuthContextInfo
 */
export interface FirebaseAuthContext {
  readonly auth?: Maybe<FirebaseAuthContextInfo>;
}

/**
 * Auth contextual information
 */
export interface FirebaseAuthContextInfo {
  /**
   * Current UID
   */
  readonly uid: string;

  /**
   * Returns true if the user is considered a system admin.
   */
  isAdmin?(): boolean;

  /**
   * Retrieves the claims in the context.
   */
  loadClaims(): Promise<AuthClaims>;

  /**
   * The auth roles provided by the token in this context.
   */
  loadAuthRoles(): Promise<AuthRoleSet>;

  /**
   * The token in the context.
   */
  readonly token: FirebaseAuthToken;
}
