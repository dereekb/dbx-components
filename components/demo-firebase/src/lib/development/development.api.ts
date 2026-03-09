import { type DevelopmentFirebaseFunctionConfigMap, type DevelopmentFirebaseFunctionMap, developmentFirebaseFunctionMapFactory, FirebaseDevelopmentFunctions, type FirebaseDevelopmentFunctionTypeMap, type FirebaseFunctionMapFunction } from '@dereekb/firebase';
import { type, type Type } from 'arktype';

export const DEMO_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH = 200;

export interface DemoDevelopmentExampleParams {
  readonly message: string;
}

export const demoDevelopmentExampleParamsType = type({
  message: `string > 0 & string <= ${DEMO_DEVELOPMENT_EXAMPLE_MAX_MESSAGE_LENGTH}`
}) as Type<DemoDevelopmentExampleParams>;

export interface DemoDevelopmentExampleResult {
  message: string;
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
