import { DevelopmentFirebaseFunctionConfigMap, DevelopmentFirebaseFunctionMap, developmentFirebaseFunctionMapFactory, FirebaseDevelopmentFunctions, FirebaseDevelopmentFunctionTypeMap, FirebaseFunctionMapFunction } from '@dereekb/firebase';
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

export const DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER = 'example';

export type DemoDevelopmentFunctionTypeMap = FirebaseDevelopmentFunctionTypeMap & {
  [DEMO_APP_EXAMPLE_DEVELOPMENT_FUNCTION_SPECIFIER]: [DemoDevelopmentExampleParams, DemoDevelopmentExampleResult];
};

export const demoDevelopmentFunctionsConfig: DevelopmentFirebaseFunctionConfigMap<DemoDevelopmentFunctionTypeMap> = {
  scheduledFunction: null,
  example: null
};

/**
 * Used to generate our ProfileFunctionMap for a Functions instance.
 */
export const demoDevelopmentFunctionMap = developmentFirebaseFunctionMapFactory<DemoDevelopmentFunctionTypeMap>(demoDevelopmentFunctionsConfig);

/**
 * Declared as an abstract class so we can inject it into our Angular app using this token.
 */
export abstract class DemoDevelopmentFunctions extends FirebaseDevelopmentFunctions implements DevelopmentFirebaseFunctionMap<DemoDevelopmentFunctionTypeMap> {
  abstract example: FirebaseFunctionMapFunction<DemoDevelopmentFunctionTypeMap, 'example'>;
}
