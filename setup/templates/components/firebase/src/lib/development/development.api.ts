import { DevelopmentFirebaseFunctionConfigMap, DevelopmentFirebaseFunctionMap, developmentFirebaseFunctionMapFactory, FirebaseDevelopmentFunctions, FirebaseDevelopmentFunctionTypeMap, FirebaseFunctionMapFunction, ScheduledFunctionDevelopmentFirebaseFunctionParams, ScheduledFunctionDevelopmentFirebaseFunctionResult, SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER } from '@dereekb/firebase';
import { type, type Type } from 'arktype';

export const EXAMPLE_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH = 200;

export interface APP_CODE_PREFIXDevelopmentExampleParams {
  readonly message: string;
}

export const appCodePrefixDevelopmentExampleParamsType = type({
  message: `string > 0 & string <= ${EXAMPLE_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH}`
}) as Type<APP_CODE_PREFIXDevelopmentExampleParams>;

export interface APP_CODE_PREFIXDevelopmentExampleResult {
  message: string;
}

export const EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER = 'example';

export type APP_CODE_PREFIXDevelopmentFunctionTypeMap = FirebaseDevelopmentFunctionTypeMap & {
  [EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER]: [APP_CODE_PREFIXDevelopmentExampleParams, APP_CODE_PREFIXDevelopmentExampleResult];
};

export const APP_CODE_PREFIXDevelopmentFunctionsConfig: DevelopmentFirebaseFunctionConfigMap<APP_CODE_PREFIXDevelopmentFunctionTypeMap> = {
  scheduledFunction: null,
  example: null
};

/**
 * Used to generate our ProfileFunctionMap for a Functions instance.
 */
export const APP_CODE_PREFIXDevelopmentFunctionMap = developmentFirebaseFunctionMapFactory<APP_CODE_PREFIXDevelopmentFunctionTypeMap>(APP_CODE_PREFIXDevelopmentFunctionsConfig);

/**
 * Declared as an abstract class so we can inject it into our Angular app using this token.
 */
export abstract class APP_CODE_PREFIXDevelopmentFunctions extends FirebaseDevelopmentFunctions implements DevelopmentFirebaseFunctionMap<APP_CODE_PREFIXDevelopmentFunctionTypeMap> {
  abstract example: FirebaseFunctionMapFunction<APP_CODE_PREFIXDevelopmentFunctionTypeMap, 'example'>;
}
