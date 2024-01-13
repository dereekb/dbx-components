import { type FirebaseAuthUserIdRef } from '../common/auth/auth';

/**
 * The model is related to a user with the model's uid.
 */
export type UserRelated = FirebaseAuthUserIdRef;

/**
 * The model is related to a user by the model's own identifier.
 */
export type UserRelatedById = object;
