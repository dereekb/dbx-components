import { environment } from './environments/environment';
import 'reflect-metadata';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { allAppFunctions, allScheduledAppFunctions, initNestServer } from './app/app';
import { demoDevelopmentFunctionMap } from './app/function/model/development.functions';
import { firebaseServerDevFunctions } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from './app/function/function';

const app = admin.initializeApp();

const { server, nest } = initNestServer(app, { environment });

export const api = onRequest(server);

// App Functions
export const { initUserOnCreate, profileSetUsername, createModel, updateModel, deleteModel } = allAppFunctions(nest);

// Scheduled Functions
const allScheduledFunctions = allScheduledAppFunctions(nest);
export const { exampleSchedule } = allScheduledFunctions;

// Admin/Developer Functions
export const { dev } = firebaseServerDevFunctions({
  enabled: true,
  nest,
  developerFunctionsMap: demoDevelopmentFunctionMap,
  onCallFactory: onCallWithDemoNestContext,
  allScheduledFunctions
});
