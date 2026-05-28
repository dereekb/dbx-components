import { type ISO8601DateString, type Maybe, type PasswordString, type PhoneNumber, splitStringAtFirstCharacterOccurence, type WebsiteUrl } from '@dereekb/util';

/**
 * Minimum password length enforced by Firebase Authentication.
 *
 * Firebase requires at least 6 characters for password-based auth.
 */
export const FIREBASE_AUTH_PASSWORD_MIN_LENGTH = 6;

/**
 * Practical maximum password length for Firebase Authentication.
 *
 * Firebase has no posted upper limit, but passwords beyond 128 characters provide diminishing security value.
 */
export const FIREBASE_AUTH_PASSWORD_MAX_LENGTH = 128;

/**
 * Unique identifier for a Firebase Authentication user (the `uid` from Firebase Auth).
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:auth
 */
export type FirebaseAuthUserId = string;

/**
 * Contains a reference to a Firebase Auth user's UID.
 */
export interface FirebaseAuthUserIdRef {
  uid: FirebaseAuthUserId;
}

/**
 * Raw encoded JWT for Firebase Auth.
 *
 * Corresponds with IdToken type in Firebase Auth.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:auth
 */
export type FirebaseAuthIdToken = string;

/**
 * Decoded Firebase Auth token information, containing user identity details from the authentication provider.
 *
 * These fields come from the Firebase Auth token and represent the user's current identity state.
 */
export interface FirebaseAuthToken {
  readonly email?: Maybe<string>;
  readonly emailVerified?: Maybe<boolean>;
  readonly phoneNumber?: Maybe<PhoneNumber>;
  /**
   * The date the user was created.
   */
  readonly creationTime?: Maybe<ISO8601DateString>;
  /**
   * The last time the user signed in.
   *
   * This is not necessarily the last time they used the app, just the last time the auth system gave them a refresh token.
   */
  readonly lastSignInTime?: Maybe<ISO8601DateString>;
  /**
   * The last time the user refreshed their token. The best indicator of recent activity.
   */
  readonly lastRefreshTime?: Maybe<ISO8601DateString>;
}

/**
 * Extended auth details combining token information with user profile fields.
 *
 * Represents the full set of user identity data available from Firebase Authentication.
 */
export interface FirebaseAuthDetails extends FirebaseAuthToken, Readonly<FirebaseAuthUserIdRef> {
  readonly disabled?: Maybe<boolean>;
  readonly displayName?: Maybe<string>;
  readonly photoURL?: Maybe<WebsiteUrl>;
}

/**
 * A string key used to test for ownership of a particular set of objects.
 *
 * For instance, a database model (or its parent) may have an ownership key associated with it that is compared with the user's current claims.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:auth
 */
export type FirebaseAuthOwnershipKey = string;

/**
 * Out-of-band (oob) code returned by Firebase Auth flows such as password reset and email verification.
 *
 * Forwarded back to Firebase (e.g. via `confirmPasswordReset`) to complete the flow.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:auth
 */
export type FirebaseAuthOobCode = string;

/**
 * Password used for completing setup or resetting a user.
 */
export type FirebaseAuthSetupPassword = PasswordString;

/**
 * Delimiter used when encoding a {@link FirebaseAuthOobCodeDataPair} into a {@link FirebaseAuthOobCode}.
 *
 * The encoded form is `${code}-${uid}` and splitting happens on the first delimiter occurrence,
 * so this only requires that the generated code/password not contain `-`. The uid is unrestricted
 * and may itself contain `-`.
 *
 * @dbxUtil
 * @dbxUtilCategory firebase-auth
 * @dbxUtilTags firebase, auth, oob, code, delimiter, constant
 * @dbxUtilRelated encode-firebase-auth-oob-code, decode-firebase-auth-oob-code
 */
export const FIREBASE_AUTH_OOB_CODE_DATA_PAIR_DELIMITER = '-';

/**
 * Data pair embedded in a {@link FirebaseAuthOobCode} for out-of-band auth flows.
 *
 * Pairs the Firebase user uid with the one-time setup/reset code so the server can
 * identify the user and validate the code in a single round-trip without a
 * separate lookup step.
 */
export interface FirebaseAuthOobCodeDataPair {
  readonly uid: FirebaseAuthUserId;
  readonly code: FirebaseAuthSetupPassword;
}

/**
 * Encodes a {@link FirebaseAuthOobCodeDataPair} into a URL-safe {@link FirebaseAuthOobCode}.
 *
 * The encoded form is `${code}-${uid}` — code first so that splitting on the first delimiter
 * still works even when the uid itself contains `-` (Firebase uids occasionally do).
 *
 * @example
 * encodeFirebaseAuthOobCode({ uid: 'abc-123', code: 'xyz789' });  // 'xyz789-abc-123'
 *
 * @dbxUtil
 * @dbxUtilCategory firebase-auth
 * @dbxUtilTags firebase, auth, oob, code, encode, uid, password, reset, setup, serialize
 * @dbxUtilRelated decode-firebase-auth-oob-code, firebase-auth-oob-code-data-pair-delimiter
 */
export function encodeFirebaseAuthOobCode(pair: FirebaseAuthOobCodeDataPair): FirebaseAuthOobCode {
  return `${pair.code}${FIREBASE_AUTH_OOB_CODE_DATA_PAIR_DELIMITER}${pair.uid}`;
}

/**
 * Decodes a {@link FirebaseAuthOobCode} back into its {@link FirebaseAuthOobCodeDataPair}.
 *
 * Splits on the first `-` so uids containing additional `-` characters survive the round-trip
 * intact. Returns null when the input is missing the delimiter or has empty parts.
 *
 * @example
 * decodeFirebaseAuthOobCode('xyz789-abc-123');  // { uid: 'abc-123', code: 'xyz789' }
 * decodeFirebaseAuthOobCode('invalid');         // null
 *
 * @dbxUtil
 * @dbxUtilCategory firebase-auth
 * @dbxUtilTags firebase, auth, oob, code, decode, parse, uid, password, reset, setup, deserialize
 * @dbxUtilRelated encode-firebase-auth-oob-code, firebase-auth-oob-code-data-pair-delimiter
 */
export function decodeFirebaseAuthOobCode(oobCode: FirebaseAuthOobCode): Maybe<FirebaseAuthOobCodeDataPair> {
  const [code, uid] = splitStringAtFirstCharacterOccurence(oobCode, FIREBASE_AUTH_OOB_CODE_DATA_PAIR_DELIMITER);
  let result: Maybe<FirebaseAuthOobCodeDataPair> = null;

  if (uid && code) {
    result = { uid, code };
  }

  return result;
}

export const FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY = 'setupPassword';
export const FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY = 'setupCommunicationAt';

/**
 * Custom claims data set on a newly-created Firebase Auth user to enable out-of-band account setup.
 *
 * The setup password is included in the invitation link so the user can verify ownership
 * without requiring an immediate sign-in flow.
 */
export interface FirebaseAuthNewUserClaimsData {
  /**
   * One-time setup password embedded in the user's claims for account initialization.
   */
  readonly setupPassword: FirebaseAuthSetupPassword;
  /**
   * ISO 8601 timestamp of the last setup-related communication (e.g., invitation email).
   */
  readonly setupCommunicationAt: ISO8601DateString;
}

export const FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY = 'resetPassword';
export const FIREBASE_SERVER_AUTH_CLAIMS_RESET_LAST_COM_DATE_KEY = 'resetCommunicationAt';
export const FIREBASE_SERVER_AUTH_CLAIMS_RESET_EXPIRES_AT_KEY = 'resetExpiresAt';

/**
 * Custom claims data set on a Firebase Auth user during a password reset flow.
 *
 * Similar to {@link FirebaseAuthNewUserClaimsData} but for reset scenarios.
 */
export interface FirebaseAuthResetUserPasswordClaimsData {
  /**
   * One-time reset password embedded in the user's claims for password reset verification.
   */
  readonly resetPassword: FirebaseAuthSetupPassword;
  /**
   * ISO 8601 timestamp of the last reset-related communication (e.g., reset email).
   */
  readonly resetCommunicationAt: ISO8601DateString;
  /**
   * ISO 8601 timestamp after which the reset code is no longer valid.
   *
   * Set when the reset is initiated; checked at completion. Resets older than this expiry
   * are rejected with the same opaque "invalid code" error as a wrong code.
   */
  readonly resetExpiresAt: ISO8601DateString;
}
