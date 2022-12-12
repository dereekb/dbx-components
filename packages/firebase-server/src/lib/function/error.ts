import { ErrorMessageOrPartialServerError, partialServerError } from '@dereekb/util';
import * as functions from 'firebase-functions';

export const NO_AUTH_ERROR_CODE = 'NO_AUTH';

export function unauthenticatedContextHasNoAuthData() {
  return unauthenticatedError({
    message: 'expected auth',
    code: NO_AUTH_ERROR_CODE
  });
}

export const NO_UID_ERROR_CODE = 'NO_USER_UID';

export function unauthenticatedContextHasNoUidError() {
  return unauthenticatedError({
    message: 'no user uid',
    code: NO_UID_ERROR_CODE
  });
}

// MARK: General Errors
export const UNAUTHENTICATED_ERROR_CODE = 'UNAUTHENTICATED';

export function unauthenticatedError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('unauthenticated', serverError?.message || 'unauthenticated', {
    status: 401,
    code: UNAUTHENTICATED_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const FORBIDDEN_ERROR_CODE = 'FORBIDDEN';

export function forbiddenError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('permission-denied', serverError?.message || 'forbidden', {
    status: 403,
    code: FORBIDDEN_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const PERMISSION_DENIED_ERROR_CODE = 'PERMISSION_DENIED';

export function permissionDeniedError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('permission-denied', serverError?.message || 'permission denied', {
    status: 403,
    code: PERMISSION_DENIED_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const NOT_FOUND_ERROR_CODE = 'NOT_FOUND';

export function notFoundError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('not-found', serverError?.message || 'not found', {
    status: 404,
    code: NOT_FOUND_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const MODEL_NOT_AVAILABLE_ERROR_CODE = 'MODEL_NOT_AVAILABLE';

export function modelNotAvailableError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('not-found', serverError?.message || 'model was not available', {
    status: 404,
    code: MODEL_NOT_AVAILABLE_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const BAD_REQUEST_ERROR_CODE = 'BAD_REQUEST';

export function badRequestError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('invalid-argument', serverError?.message || 'bad request', {
    status: 400,
    code: BAD_REQUEST_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const CONFLICT_ERROR_CODE = 'CONFLICT';

export function preconditionConflictError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('failed-precondition', serverError?.message || 'conflict', {
    status: 409,
    code: CONFLICT_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const ALREADY_EXISTS_ERROR_CODE = 'ALREADY_EXISTS';

export function alreadyExistsError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('already-exists', serverError?.message || 'already exists', {
    status: 409,
    code: ALREADY_EXISTS_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const UNAVAILABLE_ERROR_CODE = 'UNAVAILABLE';

export function unavailableError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('unavailable', serverError?.message || 'service unavailable', {
    status: 503,
    code: UNAVAILABLE_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const INTERNAL_SERVER_ERROR_CODE = 'INTERNAL_ERROR';

export function internalServerError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('internal', serverError?.message || 'internal error', {
    status: 500,
    code: INTERNAL_SERVER_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}
