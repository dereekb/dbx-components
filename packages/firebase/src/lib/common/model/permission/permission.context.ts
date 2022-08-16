import { GrantedRole } from '@dereekb/model';
import { ArrayOrValue } from '@dereekb/util';
import { FirebaseTransactionContext } from '../../firestore/reference';
import { FirebaseContextGrantedModelRoles } from './permission';

export type FirebasePermissionContext = FirebaseTransactionContext;

export type FirebasePermissionErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, role?: ArrayOrValue<GrantedRole>) => Error;
export type FirebaseDoesNotExistErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>) => Error;

export interface FirebasePermissionErrorContext {
  makePermissionError?: FirebasePermissionErrorContextErrorFunction;
  makeDoesNotExistError?: FirebasePermissionErrorContextErrorFunction;
}
