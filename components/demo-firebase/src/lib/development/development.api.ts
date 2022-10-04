import { DevelopmentFirebaseFunctionConfigMap, developmentFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const DEMO_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH = 200;

export class DemoDevelopmentExampleParams {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(DEMO_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH)
  message!: string;
}

export class DemoDevelopmentExampleResult {
  message!: string;
}

export const DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_KEY = 'example';

export type DemoDevelopmentFunctionTypeMap = {
  [DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_KEY]: [DemoDevelopmentExampleParams, DemoDevelopmentExampleResult];
};

export const demoDevelopmentFunctionsConfig: DevelopmentFirebaseFunctionConfigMap<DemoDevelopmentFunctionTypeMap> = {
  [DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_KEY]: null
};

/**
 * Used to generate our ProfileFunctionMap for a Functions instance.
 */
export const demoDevelopmentFunctionMap = developmentFirebaseFunctionMapFactory<DemoDevelopmentFunctionTypeMap>(demoDevelopmentFunctionsConfig);
