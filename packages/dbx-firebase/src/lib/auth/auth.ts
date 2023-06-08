import { safeFormatToISO8601DateString } from '@dereekb/date';
import { FirebaseAuthToken } from '@dereekb/firebase';
import { ISO8601DateString, Maybe } from '@dereekb/util';
import { User, UserInfo } from 'firebase/auth';

export type AuthUserInfo = Omit<UserInfo, 'providerId'> & {
  creationTime?: Maybe<ISO8601DateString>;
  lastSignInTime?: Maybe<ISO8601DateString>;
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
