import { type ISO8601DateString, type Maybe, type PasswordString, type PhoneNumber, type WebsiteUrl } from '@dereekb/util';

/**
 * Don't use passwords smaller tahn 6.
 */
export const FIREBASE_AUTH_PASSWORD_MIN_LENGTH = 6;

/**
 * Passwords longer than 128 characters are not useful...
 *
 * (but they are allowed by Firebase. There is no posted upper limit)
 */
export const FIREBASE_AUTH_PASSWORD_MAX_LENGTH = 128;

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
  /**
   * The date the user was created.
   */
  creationTime?: Maybe<ISO8601DateString>;
  /**
   * The last time the user signed in.
   *
   * This is not necessarily the last time they used the app, just the last time the auth system gave them a refresh token.
   */
  lastSignInTime?: Maybe<ISO8601DateString>;
  /**
   * The last time the user refreshed their token. The best indicator of recent activity.
   */
  lastRefreshTime?: Maybe<ISO8601DateString>;
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
