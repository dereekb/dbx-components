import { AuthClaims, AuthClaimsObject, AuthRoleSet, mappedUseFunction, MappedUseFunction, Maybe, UseValue } from '@dereekb/util';
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
  isAdmin(): boolean;

  /**
   * Retrieves the claims in the context.
   */
  getClaims<T extends AuthClaimsObject = AuthClaimsObject>(): AuthClaims<T>;

  /**
   * The auth roles provided by the token in this context.
   */
  getAuthRoles(): AuthRoleSet;

  /**
   * Retrieves the claims in the context.
   *
   * @deprecated Claims are now available synchronously.
   */
  loadClaims<T extends AuthClaimsObject = AuthClaimsObject>(): Promise<AuthClaims<T>>;

  /**
   * The auth roles provided by the token in this context.
   *
   * @deprecated Auth role set is now available synchronously.
   */
  loadAuthRoles(): Promise<AuthRoleSet>;

  /**
   * The token in the context.
   */
  readonly token: FirebaseAuthToken;
}

export type UseFirebaseAuthContextInfo<I extends FirebaseAuthContextInfo = FirebaseAuthContextInfo> = UseValue<I>;

export const useContextAuth: MappedUseFunction<FirebaseAuthContext, FirebaseAuthContextInfo> = mappedUseFunction((x) => x.auth);
