import * as functions from 'firebase-functions';

export function unauthenticatedContextHasNoUidError() {
  return new functions.https.HttpsError('unauthenticated', 'User has no uid.');
}

export function preconditionConflictError(message: string) {
  return new functions.https.HttpsError('failed-precondition', message);
}
