import { ErrorMessageOrPartialServerError, partialServerError } from '@dereekb/util';
import * as functions from 'firebase-functions';

export function unauthenticatedContextHasNoAuthData() {
  return new functions.https.HttpsError('unauthenticated', 'expected authentication');
}

export function unauthenticatedContextHasNoUidError() {
  return new functions.https.HttpsError('unauthenticated', 'User has no uid.');
}

// MARK: General Errors
export function unauthenticatedError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('unauthenticated', serverError?.message || 'unauthenticated', {
    status: 401,
    ...serverError,
    _error: undefined
  });
}

export function forbiddenError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('permission-denied', serverError?.message || 'forbidden', {
    status: 403,
    ...serverError,
    _error: undefined
  });
}

export function permissionDeniedError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('permission-denied', serverError?.message || 'permission denied', {
    status: 403,
    ...serverError,
    _error: undefined
  });
}

export function notFoundError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('not-found', serverError?.message || 'not found', {
    status: 404,
    ...serverError,
    _error: undefined
  });
}

export function modelNotAvailableError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('not-found', serverError?.message || 'model was not available', {
    status: 404,
    ...serverError,
    _error: undefined
  });
}

export function badRequestError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('invalid-argument', serverError?.message || 'bad request', {
    status: 400,
    ...serverError,
    _error: undefined
  });
}
export function preconditionConflictError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('failed-precondition', serverError?.message || 'conflict', {
    status: 409,
    ...serverError,
    _error: undefined
  });
}

export function alreadyExistsError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('already-exists', serverError?.message || 'already exists', {
    status: 409,
    ...serverError,
    _error: undefined
  });
}

export function unavailableError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('unavailable', serverError?.message || 'service unavailable', {
    status: 503,
    ...serverError,
    _error: undefined
  });
}

export function internalServerError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('internal', serverError?.message || 'internal error', {
    status: 500,
    ...serverError,
    _error: undefined
  });
}
