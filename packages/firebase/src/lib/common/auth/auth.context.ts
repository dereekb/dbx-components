import { AuthClaims, AuthClaimsObject, AuthRoleSet, mappedUseFunction, MappedUseFunction, Maybe, UseValue } from '@dereekb/util';
import { FirebaseAuthToken, FirebaseAuthUserId } from './auth';

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
   * The token in the context.
   */
  readonly token: FirebaseAuthToken;
}

export type UseFirebaseAuthContextInfo<I extends FirebaseAuthContextInfo = FirebaseAuthContextInfo> = UseValue<I>;

export const useContextAuth: MappedUseFunction<FirebaseAuthContext, FirebaseAuthContextInfo> = mappedUseFunction((x) => x.auth);
export const useContextAuthUid: MappedUseFunction<FirebaseAuthContext, FirebaseAuthUserId> = mappedUseFunction((x) => x.auth?.uid);
