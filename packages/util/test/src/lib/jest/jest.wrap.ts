import { AbstractWrappedFixtureWithInstance, type WrapTestContextConfig, wrapTestContextFactory, type InstanceWrapTestContextConfig, instanceWrapTestContextFactory, TestWrappedContextFactoryBuilder } from '../shared/shared.wrap';

/**
 * @deprecated Use TestWrappedContextFactoryBuilder from shared instead. This is kept for backwards compatibility.
 */
export type JestTestWrappedContextFactoryBuilder<W, F> = TestWrappedContextFactoryBuilder<W, F>;

/**
 * @deprecated Use WrapTestContextConfig from shared instead. This is kept for backwards compatibility.
 */
export type JestWrapTestContextConfig<W, F, E = any> = WrapTestContextConfig<W, F, E>;

/**
 * Wraps the input JestTestContextFactory to emit another type of Fixture for tests.
 *
 * @deprecated Use wrapTestContextFactory from shared instead. This is kept for backwards compatibility.
 * @returns
 */
export const wrapJestTestContextFactory = wrapTestContextFactory;

// MARK: EasyWrap
/**
 * @deprecated Use InstanceWrapTestContextConfig from shared instead. This is kept for backwards compatibility.
 */
export type InstanceJestWrapTestContextConfig<I, W extends AbstractWrappedFixtureWithInstance<I, F>, F> = InstanceWrapTestContextConfig<I, W, F>;

/**
 * @deprecated Use instanceWrapTestContextFactory from shared instead. This is kept for backwards compatibility.
 */
export const instanceWrapJestTestContextFactory = instanceWrapTestContextFactory;
