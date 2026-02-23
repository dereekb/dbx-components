import { type UseTestFunctionFixtureFunctionGetter, type UseTestFunctionFixture, type TestFunctionFixtureBuildTests, useTestFunctionFixture, type UseTestFunctionMapObject, type UseTestFunctionMapFixture, type UseTestFunctionMapFixtureGetterFunctions, type UseTestFunctionMapFixtureFunctions, type TestFunctionFixtureMapBuildTests, useTestFunctionMapFixture } from '../shared/shared.function';

/**
 * @deprecated Use UseTestFunctionFixtureFunctionGetter from shared instead. This is kept for backwards compatibility.
 */
export type UseJestFunctionFixtureFunctionGetter<I extends (...args: any[]) => O, O = any> = UseTestFunctionFixtureFunctionGetter<I, O>;

/**
 * @deprecated Use UseTestFunctionFixture from shared instead. This is kept for backwards compatibility.
 */
export type UseJestFunctionFixture<I extends (...args: any[]) => O, O = any> = UseTestFunctionFixture<I, O>;

/**
 * @deprecated Use TestFunctionFixtureBuildTests from shared instead. This is kept for backwards compatibility.
 */
export type JestFunctionFixtureBuildTests<I> = TestFunctionFixtureBuildTests<I>;

/**
 * @deprecated Use useTestFunctionFixture from shared instead. This is kept for backwards compatibility.
 */
export const useJestFunctionFixture = useTestFunctionFixture;

// MARK: Array Fixture
/**
 * @deprecated Use UseTestFunctionMapObject from shared instead. This is kept for backwards compatibility.
 */
export type UseJestFunctionMapObject = UseTestFunctionMapObject;

/**
 * @deprecated Use UseTestFunctionMapFixture from shared instead. This is kept for backwards compatibility.
 */
export type UseJestFunctionMapFixture<T extends UseTestFunctionMapObject> = UseTestFunctionMapFixture<T>;

/**
 * @deprecated Use UseTestFunctionMapFixtureGetterFunctions from shared instead. This is kept for backwards compatibility.
 */
export type UseJestFunctionMapFixtureGetterFunctions<T extends UseTestFunctionMapObject> = UseTestFunctionMapFixtureGetterFunctions<T>;

/**
 * @deprecated Use UseTestFunctionMapFixtureFunctions from shared instead. This is kept for backwards compatibility.
 */
export type UseJestFunctionMapFixtureFunctions<T extends UseTestFunctionMapObject> = UseTestFunctionMapFixtureFunctions<T>;

/**
 * @deprecated Use TestFunctionFixtureMapBuildTests from shared instead. This is kept for backwards compatibility.
 */
export type JestFunctionFixtureMapBuildTests<T extends UseTestFunctionMapObject> = TestFunctionFixtureMapBuildTests<T>;

/**
 * @deprecated Use useTestFunctionMapFixture from shared instead. This is kept for backwards compatibility.
 */
export const useJestFunctionMapFixture = useTestFunctionMapFixture;
