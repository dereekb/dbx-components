import { FirebaseAuthContext } from '../auth/auth.context';
import { FirebasePermissionContext } from './permission';

/**
 * A base model context that contains info about what is current occuring.
 */
export interface FirebaseModelContext extends FirebasePermissionContext, FirebaseAuthContext {
  /**
   * Whether or not to return all role checks for models as true if the auth context shows the current user as an admin.
   *
   * Is false by default.
   */
  readonly adminGetsAllowAllRoles?: boolean;
}

export interface FirebaseAppModelContext<C> extends FirebaseModelContext {
  readonly app: C;
}
