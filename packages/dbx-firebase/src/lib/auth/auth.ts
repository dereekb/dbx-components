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
