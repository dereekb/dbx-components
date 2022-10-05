import { DevelopmentFirebaseFunctionConfigMap, DevelopmentFirebaseFunctionMap, developmentFirebaseFunctionMapFactory, FirebaseDevelopmentFunctions, FirebaseDevelopmentFunctionTypeMap, FirebaseFunctionMapFunction, ScheduledFunctionDevelopmentFirebaseFunctionParams, ScheduledFunctionDevelopmentFirebaseFunctionResult, SCHEDULED_FUNCTION_DEV_FUNCTION_SPECIFIER } from '@dereekb/firebase';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const EXAMPLE_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH = 200;

export class APP_CODE_PREFIXDevelopmentExampleParams {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(EXAMPLE_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH)
  message!: string;
}

export class APP_CODE_PREFIXDevelopmentExampleResult {
  message!: string;
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
export const APP_CODE_PREFIX_LOWERDevelopmentFunctionMap = developmentFirebaseFunctionMapFactory<APP_CODE_PREFIXDevelopmentFunctionTypeMap>(APP_CODE_PREFIXDevelopmentFunctionsConfig);

/**
 * Declared as an abstract class so we can inject it into our Angular app using this token.
 */
export abstract class APP_CODE_PREFIXDevelopmentFunctions extends FirebaseDevelopmentFunctions implements DevelopmentFirebaseFunctionMap<APP_CODE_PREFIXDevelopmentFunctionTypeMap> {
  abstract example: FirebaseFunctionMapFunction<APP_CODE_PREFIXDevelopmentFunctionTypeMap, 'example'>;
}
