import { getNestServer } from './app/app';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const { server } = getNestServer();

export const api = functions.https.onRequest(server);

// TODO: Import functions
