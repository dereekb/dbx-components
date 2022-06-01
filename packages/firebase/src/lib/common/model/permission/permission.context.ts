import { FirebaseTransactionContext } from '../../firestore/reference';
import { FirebaseContextGrantedModelRoles } from './permission';

export interface FirebasePermissionContext extends FirebaseTransactionContext {}

export type FirebasePermissionErrorContextErrorFunction = (firebaseContextGrantedModelRoles: FirebaseContextGrantedModelRoles<FirebasePermissionErrorContext, unknown>, role?: string) => Error;

export interface FirebasePermissionErrorContext {
  makePermissionError?: FirebasePermissionErrorContextErrorFunction;
}
