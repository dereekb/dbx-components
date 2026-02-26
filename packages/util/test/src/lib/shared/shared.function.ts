import { forwardFunction, type Getter, mapObjectMap } from '@dereekb/util';

export type UseTestFunctionFixtureFunctionGetter<I extends (...args: any[]) => O, O = any> = Getter<I>;

export interface UseTestFunctionFixture<I extends (...args: any[]) => O, O = any> {
  fn: Getter<I>;
}

export type TestFunctionFixtureBuildTests<I> = (fn: I) => void;

/**
 * Creates a test context and configurations that provides a function to build tests based on the configuration.
 */
export function useTestFunctionFixture<I extends (...args: any[]) => O, O = any>(config: UseTestFunctionFixture<I, O>, buildTests: TestFunctionFixtureBuildTests<I>): void {
  const { fn } = config;

  const forward = forwardFunction(fn);
  buildTests(forward);
}

// MARK: Array Fixture
export type UseTestFunctionMapObject = Record<string, (...args: any[]) => any>;

export type UseTestFunctionMapFixture<T extends UseTestFunctionMapObject> = {
  fns: UseTestFunctionMapFixtureGetterFunctions<T>;
};

export type UseTestFunctionMapFixtureGetterFunctions<T extends UseTestFunctionMapObject> = {
  [K in keyof T]: T[K] extends UseTestFunctionFixtureFunctionGetter<infer I, infer O> ? T[K] : never;
};

export type UseTestFunctionMapFixtureFunctions<T extends UseTestFunctionMapObject> = {
  [K in keyof T]: T[K] extends UseTestFunctionFixtureFunctionGetter<infer I, infer O> ? I : never;
};

export type TestFunctionFixtureMapBuildTests<T extends UseTestFunctionMapObject> = (fixture: UseTestFunctionMapFixtureFunctions<T>) => void;

/**
 * Creates a test context and configurations that provides a function to build tests based on the configuration.
 */
export function useTestFunctionMapFixture<T extends UseTestFunctionMapObject>(config: UseTestFunctionMapFixture<T>, buildTests: TestFunctionFixtureMapBuildTests<T>): void {
  const forwardedFunctions = mapObjectMap(config.fns, (fn) => forwardFunction(fn));
  buildTests(forwardedFunctions);
}
