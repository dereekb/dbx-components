import { type FirebaseAuthContext } from '../auth/auth.context';
import { type FirebasePermissionContext, type FirebasePermissionErrorContext } from './permission';

/**
 * Base context for Firebase model operations, combining authentication, permission checks, and error handling.
 *
 * Passed to model services, permission evaluators, and action handlers to provide
 * information about the current caller and their authorization state.
 *
 * See {@link FirebaseAuthContext} for auth details and {@link FirebasePermissionContext} for transaction access.
 */
export interface FirebaseModelContext extends FirebasePermissionContext, FirebasePermissionErrorContext, FirebaseAuthContext {}

/**
 * Extends {@link FirebaseModelContext} with an application-specific context (e.g., Firestore collections).
 *
 * @template C - the application context type (typically the Firestore collections container)
 */
export interface FirebaseAppModelContext<C> extends FirebaseModelContext {
  readonly app: C;
}
