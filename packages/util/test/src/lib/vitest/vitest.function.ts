import { forwardFunction, type Getter, mapObjectMap } from '@dereekb/util';

export type UseVitestFunctionFixtureFunctionGetter<I extends (...args: any[]) => O, O = any> = Getter<I>;

export interface UseVitestFunctionFixture<I extends (...args: any[]) => O, O = any> {
  fn: Getter<I>;
}

export type VitestFunctionFixtureBuildTests<I> = (fn: I) => void;

/**
 * Creates a test context and vitest configurations that provides a function to build tests based on the configuration.
 */
export function useVitestFunctionFixture<I extends (...args: any[]) => O, O = any>(config: UseVitestFunctionFixture<I, O>, buildTests: VitestFunctionFixtureBuildTests<I>): void {
  const { fn } = config;

  const forward = forwardFunction(fn);
  buildTests(forward);
}

// MARK: Array Fixture
export type UseVitestFunctionMapObject = Record<string, (...args: any[]) => any>;

export type UseVitestFunctionMapFixture<T extends UseVitestFunctionMapObject> = {
  fns: UseVitestFunctionMapFixtureGetterFunctions<T>;
};

export type UseVitestFunctionMapFixtureGetterFunctions<T extends UseVitestFunctionMapObject> = {
  [K in keyof T]: T[K] extends UseVitestFunctionFixtureFunctionGetter<infer I, infer O> ? T[K] : never;
};

export type UseVitestFunctionMapFixtureFunctions<T extends UseVitestFunctionMapObject> = {
  [K in keyof T]: T[K] extends UseVitestFunctionFixtureFunctionGetter<infer I, infer O> ? I : never;
};

export type VitestFunctionFixtureMapBuildTests<T extends UseVitestFunctionMapObject> = (fixture: UseVitestFunctionMapFixtureFunctions<T>) => void;

/**
 * Creates a test context and vitest configurations that provides a function to build tests based on the configuration.
 */
export function useVitestFunctionMapFixture<T extends UseVitestFunctionMapObject>(config: UseVitestFunctionMapFixture<T>, buildTests: VitestFunctionFixtureMapBuildTests<T>): void {
  const forwardedFunctions = mapObjectMap(config.fns, (fn) => forwardFunction(fn));
  buildTests(forwardedFunctions);
}
