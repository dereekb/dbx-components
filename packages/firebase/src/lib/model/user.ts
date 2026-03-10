import { type FirebaseAuthUserIdRef } from '../common/auth/auth';

/**
 * Marker interface for models that are related to a user via a `uid` field.
 *
 * Extends {@link FirebaseAuthUserIdRef} to carry the Firebase Auth user ID.
 * Use this when the model stores the user ID explicitly as a field.
 */
export type UserRelated = FirebaseAuthUserIdRef;

/**
 * Marker interface for models related to a user by the model's own document ID.
 *
 * The document ID itself is the user's Firebase Auth UID, so no separate `uid` field is needed.
 * Use this for user-profile-style documents where the document key equals the user ID.
 */
export type UserRelatedById = object;
