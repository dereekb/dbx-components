import { FirebaseAuthContext } from '../auth/auth.context';
import { FirebasePermissionContext } from './permission';

/**
 * A base model context that contains info about what is current occuring.
 */
export interface FirebaseModelContext extends FirebasePermissionContext, FirebaseAuthContext {}

export interface FirebaseAppModelContext<C> extends FirebaseModelContext {
  readonly app: C;
}
