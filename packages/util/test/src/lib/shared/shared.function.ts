import { forwardFunction, type Getter, mapObjectMap } from '@dereekb/util';

/**
 * A getter that returns the function under test. Allows the function reference to be swapped
 * between tests without re-declaring test cases.
 */
export type UseTestFunctionFixtureFunctionGetter<I extends (...args: any[]) => O, O = any> = Getter<I>;

/**
 * Configuration for {@link useTestFunctionFixture} providing a getter for the function under test.
 */
export interface UseTestFunctionFixture<I extends (...args: any[]) => O, O = any> {
  fn: Getter<I>;
}

/**
 * Function that declares test cases using the provided forwarded function reference.
 */
export type TestFunctionFixtureBuildTests<I> = (fn: I) => void;

/**
 * Sets up a test fixture that forwards calls to a lazily-resolved function reference.
 *
 * The forwarded function delegates to the getter at call time, so the underlying implementation
 * can change between tests while test declarations remain stable.
 *
 * @param config - provides the getter for the function under test
 * @param buildTests - declares test cases using the forwarded function
 */
export function useTestFunctionFixture<I extends (...args: any[]) => O, O = any>(config: UseTestFunctionFixture<I, O>, buildTests: TestFunctionFixtureBuildTests<I>): void {
  const { fn } = config;

  const forward = forwardFunction(fn);
  buildTests(forward);
}

// MARK: Array Fixture
/**
 * A record of named functions, used as the shape for multi-function test fixtures.
 */
export type UseTestFunctionMapObject = Record<string, (...args: any[]) => any>;

/**
 * Configuration for {@link useTestFunctionMapFixture} providing getters for multiple named functions.
 */
export type UseTestFunctionMapFixture<T extends UseTestFunctionMapObject> = {
  fns: UseTestFunctionMapFixtureGetterFunctions<T>;
};

/**
 * Maps each key in `T` to its corresponding function getter type, filtering out non-getter entries.
 */
export type UseTestFunctionMapFixtureGetterFunctions<T extends UseTestFunctionMapObject> = {
  [K in keyof T]: T[K] extends UseTestFunctionFixtureFunctionGetter<infer I, infer O> ? T[K] : never;
};

/**
 * Maps each key in `T` to the unwrapped function type returned by its getter.
 * This is the shape of the object passed to test-building functions.
 */
export type UseTestFunctionMapFixtureFunctions<T extends UseTestFunctionMapObject> = {
  [K in keyof T]: T[K] extends UseTestFunctionFixtureFunctionGetter<infer I, infer O> ? I : never;
};

/**
 * Function that declares test cases using the provided map of forwarded function references.
 */
export type TestFunctionFixtureMapBuildTests<T extends UseTestFunctionMapObject> = (fixture: UseTestFunctionMapFixtureFunctions<T>) => void;

/**
 * Sets up a test fixture for multiple named functions, forwarding each to its lazily-resolved getter.
 *
 * Similar to {@link useTestFunctionFixture} but operates on a map of functions, allowing tests
 * to be declared against multiple related function implementations at once.
 *
 * @param config - provides getters for each named function under test
 * @param buildTests - declares test cases using the map of forwarded functions
 */
export function useTestFunctionMapFixture<T extends UseTestFunctionMapObject>(config: UseTestFunctionMapFixture<T>, buildTests: TestFunctionFixtureMapBuildTests<T>): void {
  const forwardedFunctions = mapObjectMap(config.fns, (fn) => forwardFunction(fn));
  buildTests(forwardedFunctions);
}
