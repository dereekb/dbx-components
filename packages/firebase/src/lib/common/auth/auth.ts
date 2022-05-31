/**
 * Firebase User Identifier (UID)
 */
export type FirebaseAuthUserId = string;

/**
 * Firebase Auth Token interface
 */
export type FirebaseAuthToken = {
  email?: string;
  emailVerified?: boolean;
  phoneNumber?: string;
};
