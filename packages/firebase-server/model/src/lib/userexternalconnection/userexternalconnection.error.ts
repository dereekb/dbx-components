import { type FirebaseAuthUserId, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { preconditionConflictError } from '@dereekb/firebase-server';

export const USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED';
export const USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED';
export const USER_EXTERNAL_CONNECTION_ALREADY_EXISTS_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_ALREADY_EXISTS';

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
