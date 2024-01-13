import { type GrantedRole } from '@dereekb/model';
import { type ArrayOrValue } from '@dereekb/util';
import { type FirebaseTransactionContext } from '../../firestore/reference';
import { type FirebaseContextGrantedModelRoles } from './permission';

export type FirebasePermissionContext = FirebaseTransactionContext;

export type FirebasePermissionErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, role?: ArrayOrValue<GrantedRole>) => Error;
export type FirebaseDoesNotExistErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>) => Error;

export interface FirebasePermissionErrorContext {
  makePermissionError?: FirebasePermissionErrorContextErrorFunction;
  makeDoesNotExistError?: FirebasePermissionErrorContextErrorFunction;
}
