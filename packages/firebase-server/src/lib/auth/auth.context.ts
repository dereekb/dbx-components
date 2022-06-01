import { FirebaseAuthToken } from '@dereekb/firebase';
import { AuthData } from 'firebase-functions/lib/common/providers/https';
import * as admin from 'firebase-admin';

export interface AuthDataRef {
  auth?: AuthData;
}

export function firebaseAuthTokenFromDecodedIdToken(token: admin.auth.DecodedIdToken): FirebaseAuthToken {
  return {
    email: token.email,
    emailVerified: token.email_verified,
    phoneNumber: token.phone_number
  };
}
