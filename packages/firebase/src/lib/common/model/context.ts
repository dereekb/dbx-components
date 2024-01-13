import { type FirebaseAuthContext } from '../auth/auth.context';
import { type FirebasePermissionContext, type FirebasePermissionErrorContext } from './permission';

/**
 * A base model context that contains info about what is current occuring.
 */
export interface FirebaseModelContext extends FirebasePermissionContext, FirebasePermissionErrorContext, FirebaseAuthContext {}

export interface FirebaseAppModelContext<C> extends FirebaseModelContext {
  readonly app: C;
}
