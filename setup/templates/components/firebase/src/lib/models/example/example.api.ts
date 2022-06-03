import { ExampleTypes } from './example';
import { Expose } from "class-transformer";
import { ModelFirebaseFunctionMap, modelFirebaseFunctionMapFactory, FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap, ModelFirebaseCrudFunctionConfigMap } from "@dereekb/firebase";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export const PROFILE_BIO_MAX_LENGTH = 200;
export const PROFILE_USERNAME_MAX_LENGTH = 30;

export class SetExampleUsernameParams {

  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(PROFILE_USERNAME_MAX_LENGTH)
  username!: string;

}

export const exampleSetUsernameKey = 'exampleSetUsername';

export type ExampleFunctionTypeMap = {
  [exampleSetUsernameKey]: [SetExampleUsernameParams, void]
}

export const exampleFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ExampleFunctionTypeMap> = {
  [exampleSetUsernameKey]: null
}

export type ExampleModelCrudFunctionsConfig = {};

export const exampleModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ExampleModelCrudFunctionsConfig, ExampleTypes> = {};

export const exampleFunctionMap = modelFirebaseFunctionMapFactory(exampleFunctionTypeConfigMap, exampleModelCrudFunctionsConfig);

export abstract class ExampleFunctions implements ModelFirebaseFunctionMap<ExampleFunctionTypeMap, ExampleModelCrudFunctionsConfig> {
  [exampleSetUsernameKey]: FirebaseFunctionMapFunction<ExampleFunctionTypeMap, "exampleSetUsername">;
}
