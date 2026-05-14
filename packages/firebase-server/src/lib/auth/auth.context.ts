import { type FirebaseAuthToken } from '@dereekb/firebase';
import { type ISO8601DateString, type Maybe } from '@dereekb/util';
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
 * including email, phone, and sign-in timestamps. `auth_time`/`iat` are Unix seconds per the
 * Firebase Admin types, so they are converted to milliseconds before being formatted. Missing
 * or non-finite values map to `undefined` (the {@link FirebaseAuthToken} fields are optional) —
 * synthetic tokens built from OIDC bearer auth do not always carry those claims, and we must
 * not throw `RangeError("Invalid time value")` from this path.
 *
 * @param token - The decoded ID token from Firebase Admin Auth.
 * @returns A normalized {@link FirebaseAuthToken} with camelCase fields.
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
    lastSignInTime: toIsoStringFromUnixSeconds(token.auth_time),
    lastRefreshTime: toIsoStringFromUnixSeconds(token.iat)
  };
}

function toIsoStringFromUnixSeconds(value: Maybe<number>): Maybe<ISO8601DateString> {
  let result: Maybe<ISO8601DateString>;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value * 1000);
    if (Number.isFinite(date.getTime())) {
      result = date.toISOString();
    }
  }
  return result;
}
