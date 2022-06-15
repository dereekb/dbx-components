import { ReadableDataError, ServerError } from '@dereekb/util';
import * as functions from 'firebase-functions';

export function unauthenticatedContextHasNoAuthData() {
  return new functions.https.HttpsError('unauthenticated', 'expected authentication');
}

export function unauthenticatedContextHasNoUidError() {
  return new functions.https.HttpsError('unauthenticated', 'User has no uid.');
}

export function preconditionConflictError(message: string) {
  return new functions.https.HttpsError('failed-precondition', message);
}

// MARK: General Errors
export function unauthenticatedError(serverError?: Partial<ServerError>) {
  return new functions.https.HttpsError('unauthenticated', serverError?.message || 'unauthenticated', {
    status: 401,
    ...serverError,
    _error: undefined
  });
}

export function forbiddenError(serverError?: Partial<ServerError>) {
  return new functions.https.HttpsError('permission-denied', serverError?.message || 'forbidden', {
    status: 403,
    ...serverError,
    _error: undefined
  });
}

export function permissionDeniedError(serverError?: ReadableDataError | ServerError) {
  return new functions.https.HttpsError('permission-denied', serverError?.message || 'permission denied', {
    status: 403,
    ...serverError,
    _error: undefined
  });
}

export function badRequestError(serverError?: ReadableDataError | ServerError) {
  return new functions.https.HttpsError('invalid-argument', serverError?.message || 'bad request', {
    status: 400,
    ...serverError,
    _error: undefined
  });
}

export function alreadyExistsError(serverError?: ReadableDataError | ServerError) {
  return new functions.https.HttpsError('already-exists', serverError?.message || 'already exists', {
    status: 409,
    ...serverError,
    _error: undefined
  });
}

export function unavailableError(serverError?: ReadableDataError | ServerError) {
  return new functions.https.HttpsError('unavailable', serverError?.message || 'service unavailable', {
    status: 503,
    ...serverError,
    _error: undefined
  });
}

export function internalServerError(serverError?: ReadableDataError | ServerError) {
  return new functions.https.HttpsError('internal', serverError?.message || 'internal error', {
    status: 500,
    ...serverError,
    _error: undefined
  });
}
