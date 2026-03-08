import { ExampleTypes } from './example';
import { ModelFirebaseFunctionMap, callModelFirebaseFunctionMapFactory, FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap, ModelFirebaseCrudFunctionConfigMap } from '@dereekb/firebase';
import { type, type Type } from 'arktype';

export const PROFILE_BIO_MAX_LENGTH = 200;
export const PROFILE_USERNAME_MAX_LENGTH = 30;

export interface SetExampleUsernameParams {
  readonly username: string;
}

export const setExampleUsernameParamsType = type({
  username: `string > 0 & string <= ${PROFILE_USERNAME_MAX_LENGTH}`
}) as Type<SetExampleUsernameParams>;

export const exampleSetUsernameKey = 'exampleSetUsername';

export type ExampleFunctionTypeMap = {
  [exampleSetUsernameKey]: [SetExampleUsernameParams, void];
};

export const exampleFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ExampleFunctionTypeMap> = {
  [exampleSetUsernameKey]: null
};

export type ExampleModelCrudFunctionsConfig = {
  example: null;
};

export const exampleModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ExampleModelCrudFunctionsConfig, ExampleTypes> = {};

export const exampleFunctionMap = callModelFirebaseFunctionMapFactory(exampleFunctionTypeConfigMap, exampleModelCrudFunctionsConfig);

export abstract class ExampleFunctions implements ModelFirebaseFunctionMap<ExampleFunctionTypeMap, ExampleModelCrudFunctionsConfig> {
  abstract [exampleSetUsernameKey]: FirebaseFunctionMapFunction<ExampleFunctionTypeMap, 'exampleSetUsername'>;
}
