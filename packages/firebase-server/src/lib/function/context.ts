import type * as functions from 'firebase-functions';
import { unauthenticatedContextHasNoAuthData } from './error';

export type CallableContextWithAuthData<R extends functions.https.CallableContext = functions.https.CallableContext> = Omit<R, 'auth'> & Required<Pick<R, 'auth'>>;

export function isContextWithAuthData<R extends functions.https.CallableContext>(context: functions.https.CallableContext): context is CallableContextWithAuthData<R> {
  return Boolean(context.auth !== null && context.auth?.uid);
}

export function assertIsContextWithAuthData<R extends functions.https.CallableContext>(context: functions.https.CallableContext): asserts context is CallableContextWithAuthData<R> {
  if (!isContextWithAuthData(context)) {
    throw unauthenticatedContextHasNoAuthData();
  }
}
