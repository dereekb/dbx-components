import { type Maybe } from '@dereekb/util';
import { type GrantedRole, type ContextGrantedModelRoles } from '@dereekb/model';
import { type DocumentSnapshot, type FirestoreDocument } from '../../firestore';
import { type FirebasePermissionErrorContext } from './permission.context';

/**
 * Snapshot of a Firestore model as loaded by the permission service for role evaluation.
 *
 * Contains the document wrapper, its snapshot, existence status, and deserialized data.
 * Passed to role-mapping functions so they can inspect the model's state to determine permissions.
 */
export interface FirebasePermissionServiceModel<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  /** The {@link FirestoreDocument} wrapper. */
  readonly document: D;
  /** The raw Firestore document snapshot. */
  readonly snapshot: DocumentSnapshot<T>;
  /** Whether the document exists in Firestore. */
  readonly exists: boolean;
  /** The deserialized document data, or `undefined` if it doesn't exist. */
  readonly data: Maybe<T>;
}

/**
 * The result of evaluating permissions for a Firebase model — contains the model data,
 * context, and the computed role map.
 *
 * Used by {@link ContextGrantedModelRolesReader} to make role-based access control decisions.
 */
export type FirebaseContextGrantedModelRoles<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = ContextGrantedModelRoles<FirebasePermissionServiceModel<T, D>, C, R>;
