import { ServerError } from '@dereekb/util';
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
export function forbiddenError(serverError: ServerError) {
  return new functions.https.HttpsError('unauthenticated', serverError.message || 'forbidden', serverError);
}

export function badRequestError(serverError: ServerError) {
  return new functions.https.HttpsError('invalid-argument', serverError.message || 'bad request', serverError);
}
