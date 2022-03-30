import { INestApplication } from '@nestjs/common';
import * as functions from 'firebase-functions';
import { HttpsFunction, Runnable } from 'firebase-functions';
import { getNestServerApp } from '../app';

export type OnCallWithNestApp<I = any, O = any> = (nest: INestApplication, data: I, context: functions.https.CallableContext) => O;

export function onCallWithNestContext<I, O>(fn: OnCallWithNestApp<I, O>): HttpsFunction & Runnable<any> {
  return functions.https.onCall((data: I, context: functions.https.CallableContext) => getNestServerApp().then(x => fn(x, data, context)));
}
