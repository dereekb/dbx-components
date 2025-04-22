import { type GrantedRole } from '@dereekb/model';
import { type FirebaseAuthUserId } from '../../auth';
import { type FirestoreModelId, type FirestoreModelKey } from './collection';

// MARK: FirestoreModelKey
/**
 * Map type with FirestoreModelKey values as keys.
 *
 * This type creates a dictionary/map structure where the keys are Firestore model keys
 * (full document paths) and the values are of the generic type T. It's useful for
 * associating arbitrary data with specific document references.
 *
 * @template T - The type of values stored in the map
 */
export type FirestoreModelKeyMap<T> = {
  readonly [key: FirestoreModelKey]: T;
};

/**
 * Array of FirestoreModelKey values.
 *
 * A simple array type for storing multiple Firestore document paths.
 * This is commonly used when working with batches of documents.
 */
export type FirestoreModelKeyArray = FirestoreModelKey[];

/**
 * A map with a single GrantedRole provided for a given model.
 *
 * This type creates a dictionary/map structure for role-based access control,
 * where Firestore document paths are mapped to specific roles. It's useful for
 * storing role assignments for documents.
 *
 * @template R - The specific granted role type (extending the base GrantedRole type)
 */
export type FirestoreModelKeyGrantedRoleMap<R extends GrantedRole> = {
  readonly [key: FirestoreModelKey]: R;
};

/**
 * A map with multiple GrantedRoles provided for a given model.
 *
 * Similar to FirestoreModelKeyGrantedRoleMap, but allows multiple roles to be
 * assigned to each document path. This is useful for more complex access control
 * systems where entities can have multiple roles for a document.
 *
 * @template R - The specific granted role type (extending the base GrantedRole type)
 */
export type FirestoreModelKeyGrantedRoleArrayMap<R extends GrantedRole> = {
  readonly [key: FirestoreModelKey]: R[];
};

// MARK: FirestoreModelId
/**
 * Map type with FirestoreModelId values as keys.
 *
 * This type creates a dictionary/map structure where the keys are Firestore model IDs
 * (document IDs without the collection path) and the values are of the generic type T.
 * It's useful when working with document IDs directly rather than full paths.
 *
 * @template T - The type of values stored in the map
 */
export type FirestoreModelIdMap<T> = {
  readonly [key: FirestoreModelId]: T;
};

/**
 * Array of FirestoreModelId values.
 *
 * A simple array type for storing multiple Firestore document IDs without their collection paths.
 * This is useful when working with batches of documents from the same collection.
 */
export type FirestoreModelIdArray = FirestoreModelId[];

/**
 * A map with a single GrantedRole provided for a given model ID.
 *
 * This type creates a dictionary/map structure for role-based access control,
 * where Firestore document IDs are mapped to specific roles. It's useful for
 * storing role assignments for documents within a single collection.
 *
 * @template R - The specific granted role type (extending the base GrantedRole type)
 */
export type FirestoreModelIdGrantedRoleMap<R extends GrantedRole> = {
  readonly [key: FirestoreModelId]: R;
};

/**
 * A map with multiple GrantedRoles provided for a given model ID.
 *
 * Similar to FirestoreModelIdGrantedRoleMap, but allows multiple roles to be
 * assigned to each document ID. This is useful for more complex access control
 * systems where entities can have multiple roles for documents in a collection.
 *
 * @template R - The specific granted role type (extending the base GrantedRole type)
 */
export type FirestoreModelIdGrantedRoleArrayMap<R extends GrantedRole> = {
  readonly [key: FirestoreModelId]: R[];
};

// MARK: Auth User
/**
 * A map with a single GrantedRole provided for a given user.
 *
 * This type creates a dictionary/map structure for role-based access control,
 * where Firebase Authentication user IDs are mapped to specific roles. It's useful for
 * storing global role assignments for users that apply across the application.
 *
 * @template R - The specific granted role type (extending the base GrantedRole type)
 */
export type FirebaseAuthUserGrantedRoleMap<R extends GrantedRole> = {
  readonly [key: FirebaseAuthUserId]: R;
};

/**
 * A map with multiple GrantedRoles provided for a given user.
 *
 * Similar to FirebaseAuthUserGrantedRoleMap, but allows multiple roles to be
 * assigned to each Firebase Authentication user ID. This is useful for more complex
 * access control systems where users can have multiple global roles.
 *
 * @template R - The specific granted role type (extending the base GrantedRole type)
 */
export type FirebaseAuthUserRoleArrayMap<R extends GrantedRole> = {
  readonly [key: FirestoreModelKey]: R[];
};
