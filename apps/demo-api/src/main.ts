import "reflect-metadata";
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { allAppFunctions, initNestServer } from './app/app';

const app = admin.initializeApp();

const { server, nest } = initNestServer(app);

export const api = onRequest(server);

export const {
  initUserOnCreate,
  profileSetUsername,
  updateProfile,
  updateGuestbookEntry
} = allAppFunctions(nest);
