import "reflect-metadata";
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { allAppFunctions, allScheduledAppFunctions, initNestServer } from './app/app';
import { APP_CODE_PREFIX_LOWERDevelopmentFunctionMap } from './app/function/model/development.functions';
import { firebaseServerDevFunctions } from '@dereekb/firebase-server';
import { onCallWithAPP_CODE_PREFIXNestContext } from './app/function/function';

const app = admin.initializeApp();

const { server, nest } = initNestServer(app);

export const api = onRequest(server);

// App Functions
export const {
  exampleSetUsername,
  createModel,
  updateModel, 
  deleteModel
} = allAppFunctions(nest);

// Scheduled Functions
const allScheduledFunctions = allScheduledAppFunctions(nest);
export const { exampleSchedule } = allScheduledFunctions;

// Admin/Developer Functions
export const { dev } = firebaseServerDevFunctions({
  enabled: true,
  nest,
  developerFunctionsMap: APP_CODE_PREFIX_LOWERDevelopmentFunctionMap,
  onCallFactory: onCallWithAPP_CODE_PREFIXNestContext,
  allScheduledFunctions
});
