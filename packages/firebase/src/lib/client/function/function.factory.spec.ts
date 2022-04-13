import { Functions } from "firebase/functions";
import { FirebaseFunctionMap } from "./function";
import { firebaseFunctionMapFactory, FirebaseFunctionTypeConfigMap } from "./function.factory";

const functionFactoryTestModelFunctionA = 'a';
const functionFactoryTestModelFunctionB = 'b';

export interface FunctionFactoryTestInputParam {
  test: string;
};

export interface FunctionFactoryTestOutputType {
  wasTest: boolean;
};

export type FunctionFactoryTestModelTypeMap = {
  [functionFactoryTestModelFunctionA]: [FunctionFactoryTestInputParam, FunctionFactoryTestOutputType],
  [functionFactoryTestModelFunctionB]: [FunctionFactoryTestInputParam, FunctionFactoryTestOutputType]
}

export const testFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<FunctionFactoryTestModelTypeMap> = {
  [functionFactoryTestModelFunctionA]: null,
  [functionFactoryTestModelFunctionB]: null
}

export type FunctionFactoryTestModelFunctionsMap = FirebaseFunctionMap<FunctionFactoryTestModelTypeMap>;

describe('firebaseFunctionMapFactory()', () => {

  const mockFunctions: Functions = {} as any;

  it('should create a factory function', () => {
    const factory = firebaseFunctionMapFactory(testFunctionTypeConfigMap);
    expect(factory).toBeDefined();
    expect(typeof factory).toBe('function');
  });

  describe('function', () => {

    it('should return a FunctionFactoryTestModelFunctionsMap for the input Functions.', () => {
      const factory = firebaseFunctionMapFactory(testFunctionTypeConfigMap);
      const instanceForFunctions: FunctionFactoryTestModelFunctionsMap = factory(mockFunctions);

      expect(instanceForFunctions).toBeDefined();
      expect(instanceForFunctions[functionFactoryTestModelFunctionA]).toBeDefined();
      expect(instanceForFunctions[functionFactoryTestModelFunctionB]).toBeDefined();
      expect(typeof instanceForFunctions[functionFactoryTestModelFunctionA]).toBe('function');
      expect(typeof instanceForFunctions[functionFactoryTestModelFunctionB]).toBe('function');
    });

  });

});
