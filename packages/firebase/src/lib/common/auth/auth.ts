import { ISO8601DateString, Maybe, PasswordString, PhoneNumber, WebsiteUrl } from '@dereekb/util';

/**
 * Firebase User Identifier (UID)
 */
export type FirebaseAuthUserId = string;

export interface FirebaseAuthUserIdRef {
  uid: FirebaseAuthUserId;
}

/**
 * Firebase Auth Token interface
 */
export interface FirebaseAuthToken {
  email?: Maybe<string>;
  emailVerified?: Maybe<boolean>;
  phoneNumber?: Maybe<PhoneNumber>;
}

export interface FirebaseAuthDetails extends FirebaseAuthToken, FirebaseAuthUserIdRef {
  disabled?: Maybe<boolean>;
  displayName?: Maybe<string>;
  photoURL?: Maybe<WebsiteUrl>;
}

/**
 * A string key used to test for ownership of a particular set of objects.
 *
 * For instance, a database model (or its parent) may have an ownership key associated with it that is compared with the user's current claims.
 */
export type FirebaseAuthOwnershipKey = string;

/**
 * Password used for completing setup or resetting a user.
 */
export type FirebaseAuthSetupPassword = PasswordString;

export const FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY = 'setupPassword';
export const FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY = 'setupCommunicationAt';

export interface FirebaseAuthNewUserClaimsData {
  /**
   * Setup password
   */
  readonly setupPassword: FirebaseAuthSetupPassword;
  /**
   * Last setup communication time.
   */
  readonly setupCommunicationAt: ISO8601DateString;
}

export const FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY = 'resetPassword';
export const FIREBASE_SERVER_AUTH_CLAIMS_RESET_LAST_COM_DATE_KEY = 'resetCommunicationAt';

export interface FirebaseAuthResetUserPasswordClaimsData {
  /**
   * Reset password
   */
  readonly resetPassword: FirebaseAuthSetupPassword;
  /**
   * Last reset communication time.
   */
  readonly resetCommunicationAt: ISO8601DateString;
}
