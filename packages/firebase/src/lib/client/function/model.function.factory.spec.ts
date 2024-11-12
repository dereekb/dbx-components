import { type Functions } from 'firebase/functions';
import { firestoreModelIdentity } from '../../common/firestore/collection/collection';
import { type FirebaseFunctionTypeConfigMap } from './function.factory';
import { type ModelFirebaseCreateFunction, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, callModelFirebaseFunctionMapFactory, type ModelFirebaseReadFunction } from './model.function.factory';

/**
 * This is our FirebaseFunctionTypeMap for Example. It defines all the functions that are available.
 */
export type ExampleFunctionTypeMap = {};

export const exampleFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<ExampleFunctionTypeMap> = {};

export const exampleIdentity = firestoreModelIdentity('example', 'e');

export type ExampleTypes = typeof exampleIdentity;

export type ExampleModelCrudFunctionsConfig = {
  example: {
    read: {
      user: [object, boolean];
    };
    create: {
      _: object;
      user: object;
    };
    update: {
      _: object;
      sendUserInvite: object;
      admin: object;
    };
    delete: object;
  };
};

export const exampleModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<ExampleModelCrudFunctionsConfig, ExampleTypes> = {
  example: ['read:user', 'create:_,user', 'update:_,sendUserInvite,admin' as any, 'delete']
};

export abstract class ExampleFunctions implements ModelFirebaseFunctionMap<ExampleFunctionTypeMap, ExampleModelCrudFunctionsConfig> {
  abstract example: {
    createExample: {
      create: ModelFirebaseCreateFunction<object>;
      createExample: ModelFirebaseCreateFunction<object>;
      user: ModelFirebaseCreateFunction<object>;
      createExampleUser: ModelFirebaseCreateFunction<object>;
    };
    readExample: {
      user: ModelFirebaseReadFunction<object, boolean>;
      readExampleUser: ModelFirebaseReadFunction<object, boolean>;
    };
    updateExample: {
      update: ModelFirebaseCrudFunction<object>;
      updateExample: ModelFirebaseCrudFunction<object>;
      admin: ModelFirebaseCrudFunction<object>;
      updateExampleAdmin: ModelFirebaseCrudFunction<object>;
      sendUserInvite: ModelFirebaseCrudFunction<object>;
      updateExampleSendUserInvite: ModelFirebaseCrudFunction<object>;
    };
    deleteExample: ModelFirebaseCrudFunction<object>;
  };
}

/**
 * Used to generate our ExampleFunctionMap for a Functions instance.
 */
export const exampleCallFunctionMap = callModelFirebaseFunctionMapFactory(exampleFunctionTypeConfigMap, exampleModelCrudFunctionsConfig);

describe('callModelFirebaseFunctionMapFactory()', () => {
  it('should create the expected functions.', () => {
    const functionsInstance: Functions = undefined as unknown as Functions;

    const result = exampleCallFunctionMap(functionsInstance) as ExampleFunctions;

    expect(result.example.createExample).toBeDefined();
    expect(result.example.createExample.create).toBeDefined();
    expect(result.example.createExample.createExample).toBeDefined();
    expect(result.example.createExample.user).toBeDefined();
    expect(result.example.createExample.createExampleUser).toBeDefined();

    expect(result.example.readExample).toBeDefined();
    expect(result.example.readExample.user).toBeDefined();
    expect(result.example.readExample.readExampleUser).toBeDefined();

    expect(result.example.updateExample).toBeDefined();
    expect(result.example.updateExample.update).toBeDefined();
    expect(result.example.updateExample.updateExample).toBeDefined();
    expect(result.example.updateExample.admin).toBeDefined();
    expect(result.example.updateExample.updateExampleAdmin).toBeDefined();
    expect(result.example.updateExample.sendUserInvite).toBeDefined();
    expect(result.example.updateExample.updateExampleSendUserInvite).toBeDefined();

    expect(result.example.deleteExample).toBeDefined();
  });
});
