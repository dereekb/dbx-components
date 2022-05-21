import { FirebaseAuthUserId } from "../common/auth/auth";

/**
 * The model is related to a user with the model's uid.
 */
export interface UserRelated {
  uid: FirebaseAuthUserId;
}

/**
 * The model is related to a user by the model's own identifier.
 */
export type UserRelatedById = object;
