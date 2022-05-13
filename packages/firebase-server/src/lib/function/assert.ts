import * as functions from 'firebase-functions';
import { isContextWithAuthData } from './context';
import { unauthenticatedContextHasNoUidError } from './error';

export function assertContextHasAuth(context: functions.https.CallableContext): void {
  if (!isContextWithAuthData(context)) {
    throw unauthenticatedContextHasNoUidError();
  }
}
