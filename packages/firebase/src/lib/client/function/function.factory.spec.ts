import { Functions } from "firebase/functions";
import { FirebaseFunctionMap } from "./function";
import { FirebaseFunctionGetter, firebaseFunctionMapFactory, FirebaseFunctionsConfigMap, FirebaseFunctionTypeConfigMap, lazyFirebaseFunctionsFactory } from "./function.factory";

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

// @ts-ignore
export abstract class FunctionFactoryTestModelFunctions implements FirebaseFunctionMap<FunctionFactoryTestModelTypeMap> { }

export const functionFactoryTestModelMap = firebaseFunctionMapFactory(testFunctionTypeConfigMap);

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

// MARK: Lazy Factory
export type FunctionFactoryTestMapFunctionsMap = {
  testFunctions: FunctionFactoryTestModelTypeMap;
}

export const TEST_FUNCTION_FACTORY_FUNCTIONS_CONFIG: FirebaseFunctionsConfigMap<FunctionFactoryTestMapFunctionsMap> = {
  testFunctions: [FunctionFactoryTestModelFunctions, functionFactoryTestModelMap]
};

export abstract class FunctionFactoryTestFunctionsGetter {
  abstract readonly testFunctions: FirebaseFunctionGetter<FunctionFactoryTestModelFunctions>;
}

describe('lazyFirebaseFunctionsFactory()', () => {

  const mockFunctions: Functions = {} as any;

  it('should create a factory function', () => {
    const factory = lazyFirebaseFunctionsFactory<FunctionFactoryTestMapFunctionsMap>(TEST_FUNCTION_FACTORY_FUNCTIONS_CONFIG);
    expect(factory).toBeDefined();
    expect(typeof factory).toBe('function');
  });

  describe('function', () => {

    it('should return a FunctionFactoryTestFunctionsGetter.', () => {
      const factory = lazyFirebaseFunctionsFactory<FunctionFactoryTestMapFunctionsMap>(TEST_FUNCTION_FACTORY_FUNCTIONS_CONFIG);
      const result = factory(mockFunctions);

      expect(result.testFunctions).toBeDefined();
      expect(result.testFunctions._type).toBeDefined();
      expect(result.testFunctions._type).toBe(FunctionFactoryTestModelFunctions);
      expect(result.testFunctions._key).toBe('testFunctions');

      const testFunctions = result.testFunctions();
      expect(testFunctions).toBeDefined();
      expect(testFunctions[functionFactoryTestModelFunctionA]).toBeDefined();
      expect(typeof testFunctions[functionFactoryTestModelFunctionA]).toBe('function');
      expect(testFunctions[functionFactoryTestModelFunctionB]).toBeDefined();
      expect(typeof testFunctions[functionFactoryTestModelFunctionB]).toBe('function');
    });

  });

});
