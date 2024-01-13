import { type Maybe } from '@dereekb/util';
import { type GrantedRole, type ContextGrantedModelRoles } from '@dereekb/model';
import { type DocumentSnapshot, type FirestoreDocument } from '../../firestore';
import { type FirebasePermissionErrorContext } from './permission.context';

export interface FirebasePermissionServiceModel<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly document: D;
  readonly snapshot: DocumentSnapshot<T>;
  readonly exists: boolean;
  readonly data: Maybe<T>;
}

export type FirebaseContextGrantedModelRoles<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = ContextGrantedModelRoles<FirebasePermissionServiceModel<T, D>, C, R>;
