import { FirebaseAuthToken } from '@dereekb/firebase';
import { User, UserInfo } from 'firebase/auth';

export type AuthUserInfo = Omit<UserInfo, 'providerId'>;

export function authUserInfoFromAuthUser(user: User): AuthUserInfo {
  return {
    displayName: user?.displayName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    photoURL: user.photoURL,
    uid: user.uid
  };
}

export function firebaseAuthTokenFromUser(user: User): FirebaseAuthToken {
  return {
    email: user.email,
    emailVerified: user.emailVerified,
    phoneNumber: user.phoneNumber
  };
}
