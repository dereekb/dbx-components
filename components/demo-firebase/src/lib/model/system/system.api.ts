import { FirebaseFunctionTypeConfigMap, ModelFirebaseCrudFunctionConfigMap, SystemStateTypes, ModelFirebaseFunctionMap, ModelFirebaseCrudFunction, callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class ExampleReadParams {
  @Expose()
  @IsString()
  message!: string;
}

export interface ExampleReadResponse {
  read: boolean;
  message: string;
}

// MARK: Keys
// MARK: Functions
export type SystemStateFunctionTypeMap = {};

export const systemStateFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<SystemStateFunctionTypeMap> = {};

export type SystemStateModelCrudFunctionsConfig = {
  systemState: {
    read: {
      exampleread: [ExampleReadParams, ExampleReadResponse];
    };
  };
};

export const systemStateModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<SystemStateModelCrudFunctionsConfig, SystemStateTypes> = {
  systemState: ['read:exampleread']
};

export abstract class SystemStateFunctions implements ModelFirebaseFunctionMap<SystemStateFunctionTypeMap, SystemStateModelCrudFunctionsConfig> {
  abstract systemState: {
    readSystemState: {
      exampleread: ModelFirebaseCrudFunction<ExampleReadParams, ExampleReadResponse>;
    };
  };
}

export const systemStateFunctionMap = callModelFirebaseFunctionMapFactory(systemStateFunctionTypeConfigMap, systemStateModelCrudFunctionsConfig);
