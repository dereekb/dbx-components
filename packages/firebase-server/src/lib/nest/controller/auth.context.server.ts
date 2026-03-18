import { type AuthData } from '../../type';
import { type Request } from 'express';
import { type FirebaseAuthUserId } from '@dereekb/firebase';

/**
 * Minimum auth data shape shared by all server-side auth contexts.
 *
 * Both Firebase's {@link AuthData} and OAuth auth contexts satisfy this interface.
 */
export interface FirebaseServerAuthData extends AuthData {
  /**
   * The authenticated user's UID.
   */
  readonly uid: FirebaseAuthUserId;
}

/**
 * Extends Express Request with an `auth` field for authenticated requests.
 *
 * Generic over the auth context type, constrained to {@link FirebaseServerAuthData}
 * so all auth contexts guarantee at least a `uid`.
 *
 * @typeParam A - The auth context type. Defaults to {@link FirebaseServerAuthData}.
 */
export interface FirebaseServerAuthenticatedRequest<A extends FirebaseServerAuthData = FirebaseServerAuthData> extends Request {
  /**
   * The auth in this request. Should not be changed.
   */
  readonly auth?: A;
}
