import { type FirebaseAuthToken } from '@dereekb/firebase';
import type * as admin from 'firebase-admin';
import { type AuthData } from '../type';

/**
 * Reference to optional {@link AuthData} from a Firebase callable function request.
 *
 * Used by {@link FirebaseServerAuthService.authContextInfo} to build auth context
 * from callable function requests where the caller may or may not be authenticated.
 */
export interface AuthDataRef<T extends AuthData = AuthData> {
  readonly auth?: T;
}

/**
 * Converts a Firebase Admin {@link admin.auth.DecodedIdToken} into a normalized {@link FirebaseAuthToken}.
 *
 * Maps Firebase Admin token fields (snake_case) to the application's token interface (camelCase),
 * including email, phone, and sign-in timestamps.
 *
 * @param token - The decoded ID token from Firebase Admin Auth.
 *
 * @example
 * ```typescript
 * const decodedToken = await admin.auth().verifyIdToken(idToken);
 * const authToken = firebaseAuthTokenFromDecodedIdToken(decodedToken);
 * ```
 */
export function firebaseAuthTokenFromDecodedIdToken(token: admin.auth.DecodedIdToken): FirebaseAuthToken {
  return {
    email: token.email,
    emailVerified: token.email_verified,
    phoneNumber: token.phone_number,
    lastSignInTime: new Date(token.auth_time).toISOString(),
    lastRefreshTime: new Date(token.iat).toISOString()
  };
}
