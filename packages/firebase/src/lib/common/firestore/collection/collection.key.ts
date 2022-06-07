import { GrantedRole } from '@dereekb/model';
import { FirebaseAuthUserId } from '../../auth';
import { FirestoreModelKey } from './collection';

export type FirestoreModelKeyMap<T> = {
  [key: FirestoreModelKey]: T;
};

/**
 * Array of FirestoreModelKey values.
 */
export type FirestoreModelKeyArray = FirestoreModelKey[];

/**
 * A map with a single GrantedRole provided for a given model.
 */
export type FirestoreModelKeyGrantedRoleMap<R extends GrantedRole> = {
  [key: FirestoreModelKey]: R;
};

/**
 * A map with multiple GrantedRoles provided for a given model.
 */
export type FirestoreModelKeyGrantedRoleArrayMap<R extends GrantedRole> = {
  [key: FirestoreModelKey]: R[];
};

/**
 * A map with a single GrantedRole provided for a given user.
 */
export type FirebaseAuthUserGrantedRoleMap<R extends GrantedRole> = {
  [key: FirebaseAuthUserId]: R;
};

/**
 * A map with multiple GrantedRoles provided for a given user.
 */
export type FirebaseAuthUserRoleArrayMap<R extends GrantedRole> = {
  [key: FirestoreModelKey]: R[];
};
