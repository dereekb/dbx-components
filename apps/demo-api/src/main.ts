import "reflect-metadata";
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { demoAppFunctions, initNestServer } from './app/app';

const app = admin.initializeApp();

const { server, nest } = initNestServer(app);

export const api = functions.https.onRequest(server);

export const {
  initUserOnCreate,
  profileSetUsername,
  guestbookEntryUpdateEntry
} = demoAppFunctions(nest);
