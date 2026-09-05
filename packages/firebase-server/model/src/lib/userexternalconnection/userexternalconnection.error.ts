import { type FirebaseAuthUserId, type UserExternalConnectionExternalAccountId, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { forbiddenError, preconditionConflictError } from '@dereekb/firebase-server';

export const USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED';
export const USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED';
export const USER_EXTERNAL_CONNECTION_ALREADY_EXISTS_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_ALREADY_EXISTS';
export const USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED';
export const USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_IN_USE_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_IN_USE';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_NOT_ENABLED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_NOT_ENABLED';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING';
export const USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE';

/**
 * Creates an error indicating the user already has a connection document.
 *
 * There is exactly one per user, so creating a second is a caller mistake rather than a conflict to
 * resolve. Clients that create on page load are expected to skip the call when the document is
 * already loaded, and to treat this code as success when two of them race.
 *
 * @param uid - The user whose document already exists.
 * @returns A precondition-conflict HttpsError.
 */
export function userExternalConnectionAlreadyExistsError(uid: FirebaseAuthUserId) {
  return preconditionConflictError({
    message: 'This user already has an external connection document.',
    code: USER_EXTERNAL_CONNECTION_ALREADY_EXISTS_ERROR_CODE,
    data: { uid }
  });
}

/**
 * Creates an error indicating the user has no connection to the requested provider.
 *
 * @param providerType - The provider that was requested.
 * @returns A precondition-conflict HttpsError.
 */
export function userExternalConnectionProviderNotConnectedError(providerType: UserExternalConnectionProviderType) {
  return preconditionConflictError({
    message: `This user is not connected to "${providerType}".`,
    code: USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE,
    data: { providerType }
  });
}

/**
 * Creates an error indicating the user's credentials for a provider have expired and could not be
 * renewed.
 *
 * Distinct from {@link userExternalConnectionProviderNotConnectedError}: the user IS connected and the
 * credentials are still stored, they just cannot be used right now. Either no refresher was configured,
 * the provider has no refresh path, or the refresh itself failed. The remedy for the last of those is a
 * reconnect; for the first two it is a configuration change, so the code is deliberately the same and
 * the distinction is left to the server logs.
 *
 * @param providerType - The provider whose credentials expired.
 * @returns A precondition-conflict HttpsError.
 */
export function userExternalConnectionCredentialsExpiredError(providerType: UserExternalConnectionProviderType) {
  return preconditionConflictError({
    message: `This user's "${providerType}" credentials have expired and could not be renewed.`,
    code: USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE,
    data: { providerType }
  });
}

/**
 * Creates an error indicating the requested provider is not one this app allows connecting to.
 *
 * @param providerType - The provider that was requested.
 * @returns A precondition-conflict HttpsError.
 */
export function userExternalConnectionProviderNotAllowedError(providerType: UserExternalConnectionProviderType) {
  return preconditionConflictError({
    message: `"${providerType}" is not an allowed external connection provider.`,
    code: USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE,
    data: { providerType }
  });
}

/**
 * Creates an error indicating another user already holds the external account being connected.
 *
 * Raised only for a provider whose policy declares its connections `unique` with `onCollision: 'block'`.
 * The holder's uid is deliberately absent from the message and present only in `data`, which is
 * server-side: telling a caller which account owns a Discord id is an account-enumeration oracle.
 *
 * @param providerType - The provider whose account is contested.
 * @param externalAccountId - The contested external account id.
 * @param existingUid - The uid that already holds it.
 * @returns A precondition-conflict HttpsError.
 */
export function userExternalConnectionExternalAccountInUseError(providerType: UserExternalConnectionProviderType, externalAccountId: UserExternalConnectionExternalAccountId, existingUid: FirebaseAuthUserId) {
  return preconditionConflictError({
    message: `That "${providerType}" account is already connected to another user.`,
    code: USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_IN_USE_ERROR_CODE,
    data: { providerType, externalAccountId, existingUid }
  });
}

/**
 * Creates an error indicating the provider is not configured to be used for signing in.
 *
 * Distinct from {@link userExternalConnectionProviderNotAllowedError}: the provider IS allowed, just
 * not in the sign-in direction. Sign-in is opt-in per provider precisely so an app cannot acquire an
 * unauthenticated account-creation surface by registering a connect provider.
 *
 * @param providerType - The provider a sign-in was attempted with.
 * @returns A forbidden HttpsError.
 */
export function userExternalConnectionSignInNotEnabledError(providerType: UserExternalConnectionProviderType) {
  return forbiddenError({
    message: `"${providerType}" cannot be used to sign in.`,
    code: USER_EXTERNAL_CONNECTION_SIGN_IN_NOT_ENABLED_ERROR_CODE,
    data: { providerType }
  });
}

/**
 * Creates an error indicating the app's sign-in delegate refused the identity.
 *
 * The delegate's `reason` rides in `data` rather than the message: it typically describes why an
 * account does not qualify (no subscription, not a guild member), which is not something to hand back
 * to an unauthenticated caller.
 *
 * @param providerType - The provider the sign-in was attempted with.
 * @param reason - The delegate's reason, for the server log.
 * @returns A forbidden HttpsError.
 */
export function userExternalConnectionSignInDeniedError(providerType: UserExternalConnectionProviderType, reason: string) {
  return forbiddenError({
    message: `That "${providerType}" account cannot sign in.`,
    code: USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE,
    data: { providerType, reason }
  });
}

/**
 * Creates an error indicating a new user could not be created because the provider's email already
 * belongs to a Firebase user.
 *
 * Adopting that account would let whoever controls the third-party email take over the Firebase one,
 * so the sign-in fails instead. The remedy is an explicit link performed by the already-signed-in
 * user — which is what the connect flow is.
 *
 * @param providerType - The provider the sign-in was attempted with.
 * @returns A precondition-conflict HttpsError.
 */
export function userExternalConnectionSignInEmailConflictError(providerType: UserExternalConnectionProviderType) {
  return preconditionConflictError({
    message: `An account already exists for the email on that "${providerType}" account. Sign in and connect "${providerType}" from your settings instead.`,
    code: USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE,
    data: { providerType }
  });
}

/**
 * Creates an error indicating the uid a sign-in resolved to no longer exists in Firebase Auth.
 *
 * Reachable when a user is deleted from Auth without their connection documents being cleaned up:
 * minting a token for a deleted uid produces a signed-in session with no user record behind it.
 *
 * @param providerType - The provider the sign-in was attempted with.
 * @returns A precondition-conflict HttpsError.
 */
export function userExternalConnectionSignInUserMissingError(providerType: UserExternalConnectionProviderType) {
  return preconditionConflictError({
    message: `The user connected to that "${providerType}" account no longer exists.`,
    code: USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING_ERROR_CODE,
    data: { providerType }
  });
}

/**
 * Creates an error indicating the provider returned no stable account id to identify the user by.
 *
 * A connect can proceed without one (it only costs the settings row its label), but a sign-in cannot:
 * with no stable id there is nothing to key the identity on, and falling back to a mutable username
 * or an email would be the takeover vector this design exists to avoid.
 *
 * @param providerType - The provider the sign-in was attempted with.
 * @returns A precondition-conflict HttpsError.
 */
export function userExternalConnectionSignInIdentityUnavailableError(providerType: UserExternalConnectionProviderType) {
  return preconditionConflictError({
    message: `Could not read the "${providerType}" account to sign in with.`,
    code: USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE_ERROR_CODE,
    data: { providerType }
  });
}
