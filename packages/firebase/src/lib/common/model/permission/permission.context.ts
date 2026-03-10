import { type GrantedRole } from '@dereekb/model';
import { type ArrayOrValue } from '@dereekb/util';
import { type FirebaseTransactionContext } from '../../firestore/reference';
import { type FirebaseContextGrantedModelRoles } from './permission';

/**
 * Context type for permission operations — provides optional Firestore transaction access.
 */
export type FirebasePermissionContext = FirebaseTransactionContext;

/**
 * Factory function for creating permission-denied errors, given the model roles and the required role(s).
 */
export type FirebasePermissionErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, role?: ArrayOrValue<GrantedRole>) => Error;

/**
 * Factory function for creating "does not exist" errors when a model document is not found.
 */
export type FirebaseDoesNotExistErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>) => Error;

/**
 * Context that provides custom error factories for permission and existence checks.
 *
 * When these factories are not provided, the system falls back to generic error messages.
 * Applications typically supply these to produce HTTP-appropriate errors (e.g., 403, 404).
 */
export interface FirebasePermissionErrorContext {
  makePermissionError?: FirebasePermissionErrorContextErrorFunction;
  makeDoesNotExistError?: FirebasePermissionErrorContextErrorFunction;
}
