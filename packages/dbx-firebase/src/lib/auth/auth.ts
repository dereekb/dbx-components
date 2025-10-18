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
};

export function authUserInfoFromAuthUser(user: User): AuthUserInfo {
  return {
    displayName: user?.displayName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    photoURL: user.photoURL,
    uid: user.uid,
    creationTime: safeFormatToISO8601DateString(user.metadata.creationTime),
    lastSignInTime: safeFormatToISO8601DateString(user.metadata.lastSignInTime)
  };
}

export function firebaseAuthTokenFromUser(user: User): FirebaseAuthToken {
  return {
    email: user.email,
    emailVerified: user.emailVerified,
    phoneNumber: user.phoneNumber,
    creationTime: safeFormatToISO8601DateString(user.metadata.creationTime),
    lastSignInTime: safeFormatToISO8601DateString(user.metadata.lastSignInTime)
  };
}
