import { AuthClaims, AuthRoleSet, PromiseOrValue } from '@dereekb/util';
import { FirebaseAuthToken } from './auth';

/**
 * Provides a context containing FirebaseAuthContextInfo
 */
export interface FirebaseAuthContext {
  readonly auth?: FirebaseAuthContextInfo;
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
