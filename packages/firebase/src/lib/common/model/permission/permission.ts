import { Maybe } from '@dereekb/util';
import { GrantedRole, ContextGrantedModelRoles } from '@dereekb/model';
import { DocumentSnapshot, FirestoreDocument } from '../../firestore';
import { FirebasePermissionErrorContext } from './permission.context';

export interface FirebasePermissionServiceModel<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly document: D;
  readonly snapshot: DocumentSnapshot<T>;
  readonly exists: boolean;
  readonly data: Maybe<T>;
}

export type FirebaseContextGrantedModelRoles<C extends FirebasePermissionErrorContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends GrantedRole = GrantedRole> = ContextGrantedModelRoles<FirebasePermissionServiceModel<T, D>, C, R>;
