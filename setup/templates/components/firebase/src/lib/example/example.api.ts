import { Expose } from "class-transformer";
import { FirebaseFunctionMap, firebaseFunctionMapFactory, FirebaseFunctionMapFunction, FirebaseFunctionTypeConfigMap } from "@dereekb/firebase";
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

export abstract class ExampleFunctions implements FirebaseFunctionMap<ExampleFunctionTypeMap> {
  [exampleSetUsernameKey]: FirebaseFunctionMapFunction<ExampleFunctionTypeMap, "exampleSetUsername">;
}

export const exampleFunctionMap = firebaseFunctionMapFactory(exampleFunctionTypeConfigMap);
