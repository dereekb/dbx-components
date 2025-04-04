import { forwardFunction, type Getter, mapObjectMap } from '@dereekb/util';

export type UseJestFunctionFixtureFunctionGetter<I extends (...args: any[]) => O, O = any> = Getter<I>;

export interface UseJestFunctionFixture<I extends (...args: any[]) => O, O = any> {
  fn: Getter<I>;
}

export type JestFunctionFixtureBuildTests<I> = (fn: I) => void;

/**
 * Creates a test context and jest configurations that provides a function to build tests based on the configuration.
 */
export function useJestFunctionFixture<I extends (...args: any[]) => O, O = any>(config: UseJestFunctionFixture<I, O>, buildTests: JestFunctionFixtureBuildTests<I>): void {
  const { fn } = config;

  const forward = forwardFunction(fn);
  buildTests(forward);
}

// MARK: Array Fixture
export type UseJestFunctionMapObject = Record<string, (...args: any[]) => any>;

export type UseJestFunctionMapFixture<T extends UseJestFunctionMapObject> = {
  fns: UseJestFunctionMapFixtureGetterFunctions<T>;
};

export type UseJestFunctionMapFixtureGetterFunctions<T extends UseJestFunctionMapObject> = {
  [K in keyof T]: T[K] extends UseJestFunctionFixtureFunctionGetter<infer I, infer O> ? T[K] : never;
};

export type UseJestFunctionMapFixtureFunctions<T extends UseJestFunctionMapObject> = {
  [K in keyof T]: T[K] extends UseJestFunctionFixtureFunctionGetter<infer I, infer O> ? I : never;
};

export type JestFunctionFixtureMapBuildTests<T extends UseJestFunctionMapObject> = (fixture: UseJestFunctionMapFixtureFunctions<T>) => void;

/**
 * Creates a test context and jest configurations that provides a function to build tests based on the configuration.
 */
export function useJestFunctionMapFixture<T extends UseJestFunctionMapObject>(config: UseJestFunctionMapFixture<T>, buildTests: JestFunctionFixtureMapBuildTests<T>): void {
  const forwardedFunctions = mapObjectMap(config.fns, (fn) => forwardFunction(fn));
  buildTests(forwardedFunctions);
}
