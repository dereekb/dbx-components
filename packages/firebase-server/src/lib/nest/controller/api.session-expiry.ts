import { type Maybe, type UnixDateTimeSecondsNumber } from '@dereekb/util';
import { type FirebaseServerAuthData } from './auth.context.server';

/**
 * Access-token `extra` claim carrying the grant's resolved expiry as unix seconds.
 *
 * Baked on at issuance (`extraTokenClaims`) and read back by `verifyAccessToken` and the
 * `GET /oidc/session` route so clients can surface the session lifetime without decoding the token.
 *
 * Declared in this core layer (and re-exported by `@dereekb/firebase-server/oidc`) so non-OIDC
 * endpoints such as the direct-Firestore session can bound what they mint by the caller's own
 * lifetime without importing the OIDC sub-package.
 */
export const DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM = 'dbx_session_expires_at';

/**
 * Reads when the CALLER's own OIDC grant expires, from the {@link DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM}
 * claim baked onto the access token at issuance.
 *
 * Returns `undefined` when the claim is absent — a non-OIDC caller (plain Firebase ID token), or a
 * token issued before the claim existed. Callers must treat that as "no bound", not "expired".
 *
 * @param auth - The request auth data, or undefined for unauthenticated requests.
 * @returns The caller's grant expiry in unix seconds, or `undefined`.
 */
export function oidcSessionExpiresAtFromRequestAuth(auth: Maybe<FirebaseServerAuthData>): Maybe<UnixDateTimeSecondsNumber> {
  const claims = (auth as Maybe<{ oidcValidatedToken?: Record<string, unknown>; token?: Record<string, unknown> }>) ?? {};
  const raw = claims.oidcValidatedToken?.[DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM] ?? claims.token?.[DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}
