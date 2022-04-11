import * as functions from 'firebase-functions';

export type CallableContextWithAuthData = Omit<functions.https.CallableContext, 'auth'> & Required<Pick<functions.https.CallableContext, 'auth'>>;

export function isContextWithAuthData(context: functions.https.CallableContext): context is CallableContextWithAuthData {
  return Boolean((context.auth) !== null && context.auth?.uid);
}
