import { safeFormatToISO8601DateString } from '@dereekb/date';
import { type FirebaseAuthToken } from '@dereekb/firebase';
import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { type User, type UserInfo } from 'firebase/auth';

export type AuthUserInfo = Omit<UserInfo, 'providerId'> & {
  /**
   * The creation time of the user's account.
   */
  readonly creationTime?: Maybe<ISO8601DateString>;
  /**
   * The last time the user signed in and recieved a refresh token.
   */
  readonly lastSignInTime?: Maybe<ISO8601DateString>;
  /**
   * Provider data for each linked authentication provider.
   */
  readonly providerData?: UserInfo[];
};

/**
 * Converts a Firebase Auth {@link User} into an {@link AuthUserInfo} containing display name, email, phone, photo URL, UID, and metadata timestamps.
 *
 * @param user - The Firebase Auth user to convert.
 * @returns An AuthUserInfo object with the user's profile and metadata.
 */
export function authUserInfoFromAuthUser(user: User): AuthUserInfo {
  return {
    displayName: user?.displayName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    photoURL: user.photoURL,
    uid: user.uid,
    creationTime: safeFormatToISO8601DateString(user.metadata.creationTime),
    lastSignInTime: safeFormatToISO8601DateString(user.metadata.lastSignInTime),
    providerData: user.providerData
  };
}

/**
 * Extracts a {@link FirebaseAuthToken} from a Firebase Auth {@link User}, including email verification status and metadata timestamps.
 *
 * @param user - The Firebase Auth user to extract token info from.
 * @returns A FirebaseAuthToken with the user's auth-related properties.
 */
export function firebaseAuthTokenFromUser(user: User): FirebaseAuthToken {
  return {
    email: user.email,
    emailVerified: user.emailVerified,
    phoneNumber: user.phoneNumber,
    creationTime: safeFormatToISO8601DateString(user.metadata.creationTime),
    lastSignInTime: safeFormatToISO8601DateString(user.metadata.lastSignInTime)
  };
}
