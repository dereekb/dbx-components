import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { demoAppFunctions, initNestServer } from './app/app';

admin.initializeApp();

const { server, nest } = initNestServer();

export const api = functions.https.onRequest(server);

export const {
  // initUserOnCreate,
  profileSetUsername
} = demoAppFunctions(nest);
