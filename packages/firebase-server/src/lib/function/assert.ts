import * as functions from 'firebase-functions';

export function assertIsLoggedIn(context: functions.https.CallableContext) {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User has no uid.');
  }
}
