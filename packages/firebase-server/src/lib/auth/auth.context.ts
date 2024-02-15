import { type FirebaseAuthToken } from '@dereekb/firebase';
import { type AuthData } from 'firebase-functions/lib/common/providers/https';
import type * as admin from 'firebase-admin';

export interface AuthDataRef {
  readonly auth?: AuthData;
}

export function firebaseAuthTokenFromDecodedIdToken(token: admin.auth.DecodedIdToken): FirebaseAuthToken {
  return {
    email: token.email,
    emailVerified: token.email_verified,
    phoneNumber: token.phone_number,
    lastSignInTime: new Date(token.auth_time).toISOString(),
    lastRefreshTime: new Date(token.iat).toISOString()
  };
}
