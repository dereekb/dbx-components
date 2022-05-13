import * as functions from 'firebase-functions';
import { unauthenticatedContextHasNoAuthData } from './error';

export type CallableContextWithAuthData = Omit<functions.https.CallableContext, 'auth'> & Required<Pick<functions.https.CallableContext, 'auth'>>;

export function isContextWithAuthData(context: functions.https.CallableContext): context is CallableContextWithAuthData {
  return Boolean((context.auth) !== null && context.auth?.uid);
}

export function assertIsContextWithAuthData(context: functions.https.CallableContext): asserts context is CallableContextWithAuthData {
  if (!isContextWithAuthData(context)) {
    throw unauthenticatedContextHasNoAuthData();
  }
}
