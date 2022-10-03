import { environment } from './environments/environment';
import 'reflect-metadata';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { allAppFunctions, allScheduledAppFunctions, initNestServer } from './app/app';

const app = admin.initializeApp();

const { server, nest } = initNestServer(app, { environment });

export const api = onRequest(server);

// App Functions
export const { initUserOnCreate, profileSetUsername, createModel, updateModel, deleteModel } = allAppFunctions(nest);

// Scheduled Functions
const scheduledFunctions = allScheduledAppFunctions(nest);

export const { exampleSchedule } = scheduledFunctions;
