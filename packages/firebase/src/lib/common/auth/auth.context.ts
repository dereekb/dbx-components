import { type AuthClaims, type AuthClaimsObject, type AuthRoleSet, mappedUseFunction, type MappedUseFunction, type Maybe, type UseValue } from '@dereekb/util';
import { type FirebaseAuthToken, type FirebaseAuthUserId } from './auth';

/**
 * Context that optionally carries the current user's authentication state.
 *
 * Used throughout the Firebase model and permission system to determine what
 * the current caller is authorized to do. A missing `auth` implies an unauthenticated request.
 */
export interface FirebaseAuthContext {
  readonly auth?: Maybe<FirebaseAuthContextInfo>;
}

/**
 * Resolved authentication information for the current request/context.
 *
 * Provides the user's UID, admin status, custom claims, and auth roles.
 * Typically derived from a decoded Firebase ID token or the Firebase Admin SDK.
 */
export interface FirebaseAuthContextInfo {
  /**
   * Current UID
   */
  readonly uid: FirebaseAuthUserId;

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

/**
 * {@link UseValue} wrapper for {@link FirebaseAuthContextInfo}.
 */
export type UseFirebaseAuthContextInfo<I extends FirebaseAuthContextInfo = FirebaseAuthContextInfo> = UseValue<I>;

/**
 * Extracts the {@link FirebaseAuthContextInfo} from a {@link FirebaseAuthContext}.
 */
export const useContextAuth: MappedUseFunction<FirebaseAuthContext, FirebaseAuthContextInfo> = mappedUseFunction((x) => x.auth);

/**
 * Extracts the user UID directly from a {@link FirebaseAuthContext}.
 */
export const useContextAuthUid: MappedUseFunction<FirebaseAuthContext, FirebaseAuthUserId> = mappedUseFunction((x) => x.auth?.uid);
