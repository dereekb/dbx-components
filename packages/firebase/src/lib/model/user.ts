
/**
 * Firebase User Identifier (UID)
 */
export type FirebaseAuthUserId = string;

/**
 * The model is related to a user with the model's uid.
 */
export interface UserRelated {
  uid: FirebaseAuthUserId;
}

/**
 * The model is related to a user by the model's own identifier.
 */
export interface UserRelatedById { }
