import { ScheduledFunctionDevelopmentFirebaseFunctionParams, ScheduledFunctionDevelopmentFirebaseFunctionResult } from '../../common/development/function.schedule';
import { FirebaseFunction } from './function';

/**
 * The default functions key for the FirebaseDevelopmentFunctionTypeMap/Functions, used in an app's functions map.
 */
export const FIREBASE_DEVELOPMENT_FUNCTIONS_MAP_KEY = 'developmentFunctions';

/**
 * Base map of all development functions enabled by the server.
 */
export type FirebaseDevelopmentFunctionTypeMap = {
  scheduledFunction: [ScheduledFunctionDevelopmentFirebaseFunctionParams, ScheduledFunctionDevelopmentFirebaseFunctionResult];
};

/**
 * Base DevelopmentFirebaseFunctionMap for all development functions enabled by the server (via firebaseServerDevFunctions())
 *
 * Is used by dbx-firebase
 */
export abstract class FirebaseDevelopmentFunctions {
  abstract scheduledFunction: FirebaseFunction<ScheduledFunctionDevelopmentFirebaseFunctionParams, ScheduledFunctionDevelopmentFirebaseFunctionResult>;
}
