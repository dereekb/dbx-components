import { type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type SystemStateTypes, type ModelFirebaseFunctionMap, type ModelFirebaseCrudFunction, callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';
import { type, type Type } from 'arktype';

export interface ExampleReadParams {
  readonly message: string;
}

export const exampleReadParamsType = type({
  message: 'string'
}) as Type<ExampleReadParams>;

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
