import { DemoDevelopmentFunctionTypeMap } from '@dereekb/demo-firebase';
import { ScheduledFunctionDevelopmentFirebaseFunctionParams, ScheduledFunctionDevelopmentFirebaseFunctionResult, SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER } from '../../common/development/function.schedule';
import { FirebaseFunctionMapFunction } from './function';

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
  abstract scheduledFunction: FirebaseFunctionMapFunction<DemoDevelopmentFunctionTypeMap, 'scheduledFunction'>;
}
