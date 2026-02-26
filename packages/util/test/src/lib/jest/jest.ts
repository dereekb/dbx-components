import { type TestFixtureInstance, type TestFixture, type TestContextFixtureClearInstanceFunction, type TestContextFixture, AbstractTestContextFixture, AbstractChildTestContextFixture, type BuildTestsWithContextFunction, type TestContextFactory, type TestContextBuilderFunction, type TestContextBuilderConfig, testContextBuilder, type UseContextFixture, useTestContextFixture } from '../shared/shared';

/**
 * @deprecated Use TestFixtureInstance from shared instead. This is kept for backwards compatibility.
 */
export type JestTestFixtureInstance<I> = TestFixtureInstance<I>;

/**
 * @deprecated Use TestFixture from shared instead. This is kept for backwards compatibility.
 */
export type JestTestFixture<I> = TestFixture<I>;

/**
 * @deprecated Use TestContextFixtureClearInstanceFunction from shared instead. This is kept for backwards compatibility.
 */
export type JestTestContextFixtureClearInstanceFunction = TestContextFixtureClearInstanceFunction;

/**
 * @deprecated Use TestContextFixture from shared instead. This is kept for backwards compatibility.
 */
export type JestTestContextFixture<I> = TestContextFixture<I>;

/**
 * @deprecated Use AbstractTestContextFixture from shared instead. This is kept for backwards compatibility.
 */
export abstract class AbstractJestTestContextFixture<I> extends AbstractTestContextFixture<I> {}

/**
 * @deprecated Use AbstractChildTestContextFixture from shared instead. This is kept for backwards compatibility.
 */
export abstract class AbstractChildJestTestContextFixture<I, P extends TestContextFixture<any>> extends AbstractChildTestContextFixture<I, P> {}

/**
 * @deprecated Use BuildTestsWithContextFunction from shared instead. This is kept for backwards compatibility.
 */
export type JestBuildTestsWithContextFunction<F> = BuildTestsWithContextFunction<F>;

/**
 * @deprecated Use TestContextFactory from shared instead. This is kept for backwards compatibility.
 */
export type JestTestContextFactory<F> = TestContextFactory<F>;

/**
 * @deprecated Use TestContextBuilderFunction from shared instead. This is kept for backwards compatibility.
 */
export type JestTestContextBuilderFunction<I, F extends TestContextFixture<I>, C> = TestContextBuilderFunction<I, F, C>;

/**
 * @deprecated Use TestContextBuilderConfig from shared instead. This is kept for backwards compatibility.
 */
export type JestTestContextBuilderConfig<I, F extends TestContextFixture<I>, C> = TestContextBuilderConfig<I, F, C>;

/**
 * @deprecated Use testContextBuilder from shared instead. This is kept for backwards compatibility.
 */
export const jestTestContextBuilder = testContextBuilder;

/**
 * @deprecated Use UseContextFixture from shared instead. This is kept for backwards compatibility.
 */
export type UseJestContextFixture<C extends TestContextFixture<I>, I> = UseContextFixture<C, I>;

/**
 * @deprecated Use useContextFixture from shared instead. This is kept for backwards compatibility.
 */
export const useJestContextFixture = useTestContextFixture;
