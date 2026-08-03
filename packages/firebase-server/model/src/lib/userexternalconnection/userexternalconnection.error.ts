import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { preconditionConflictError } from '@dereekb/firebase-server';

export const USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED';
export const USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE = 'USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED';

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
