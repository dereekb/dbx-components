import { FirebaseAuthToken } from '@dereekb/firebase';
import { ISO8601DateString } from '@dereekb/util';
import { User, UserInfo, UserMetadata } from 'firebase/auth';

export type AuthUserInfo = Omit<UserInfo, 'providerId'> & UserMetadata;

export function authUserInfoFromAuthUser(user: User): AuthUserInfo {
  return {
    displayName: user?.displayName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    photoURL: user.photoURL,
    uid: user.uid,
    creationTime: user.metadata.creationTime,
    lastSignInTime: user.metadata.lastSignInTime
  };
}

export function firebaseAuthTokenFromUser(user: User): FirebaseAuthToken {
  return {
    email: user.email,
    emailVerified: user.emailVerified,
    phoneNumber: user.phoneNumber,
    creationTime: user.metadata.creationTime,
    lastSignInTime: user.metadata.lastSignInTime
  };
}
