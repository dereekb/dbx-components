import { GrantedRole } from '@dereekb/model';
import { FirebaseAuthUserId } from '../../auth';
import { FirestoreModelId, FirestoreModelKey } from './collection';

// MARK: FirestoreModelKey
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

// MARK: FirestoreModelId
export type FirestoreModelIdMap<T> = {
  [key: FirestoreModelId]: T;
};

/**
 * Array of FirestoreModelId values.
 */
export type FirestoreModelIdArray = FirestoreModelId[];

/**
 * A map with a single GrantedRole provided for a given model.
 */
export type FirestoreModelIdGrantedRoleMap<R extends GrantedRole> = {
  [key: FirestoreModelId]: R;
};

/**
 * A map with multiple GrantedRoles provided for a given model.
 */
export type FirestoreModelIdGrantedRoleArrayMap<R extends GrantedRole> = {
  [key: FirestoreModelId]: R[];
};

// MARK: Auth User
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
