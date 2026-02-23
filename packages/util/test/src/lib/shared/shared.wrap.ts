import { AbstractTestContextFixture, type BuildTestsWithContextFunction, type TestContextFactory, type TestContextFixtureClearInstanceFunction } from './shared';

export abstract class AbstractWrappedFixture<F> {
  constructor(readonly fixture: F) {}
}

export abstract class AbstractWrappedFixtureWithInstance<I, F> extends AbstractTestContextFixture<I> {
  constructor(readonly parent: F) {
    super();
  }
}

/**
 * Used to wrap a TestContextFactory of one fixture type to another.
 *
 * This is useful for cases where the base fixture may be used in a lot of places and contexts, but the wrapped version can configure
 * tests more specifically.
 */
export type TestWrappedContextFactoryBuilder<W, F> = (factory: TestContextFactory<F>) => TestContextFactory<W>;

export interface WrapTestContextConfig<W, F, E = any> {
  /**
   * Wraps the fixture. This occurs once before any tests execute.
   */
  wrapFixture: (fixture: F) => W;

  /**
   * Use for doing any setup that may be required on a per-test basis.
   *
   * This occurs before every test, but after the fixture's instance has already been configured.
   *
   * The setup can return an effect. This effect is passed to the teardown function later, if provided.
   */
  setupWrap?: (wrap: W) => Promise<E>;

  /**
   * Use for cleaning up the instance before the next function.
   *
   * This occurs after every test, but after the fixture's instance has already been configured.
   */
  teardownWrap?: (wrap: W, effect: E) => Promise<void>;
}

/**
 * Wraps the input TestContextFactory to emit another type of Fixture for tests.
 *
 * @returns
 */
export function wrapTestContextFactory<W, F, E = any>(config: WrapTestContextConfig<W, F, E>): (factory: TestContextFactory<F>) => TestContextFactory<W> {
  return (factory: TestContextFactory<F>) => {
    return (buildTests: BuildTestsWithContextFunction<W>) => {
      factory((inputFixture: F) => {
        const wrap = config.wrapFixture(inputFixture);
        let effect: E;

        // add before each
        if (config.setupWrap != null) {
          beforeEach(async () => {
            effect = await config.setupWrap!(wrap);
          });
        }

        // add tests
        buildTests(wrap);

        // add after each
        if (config.teardownWrap != null) {
          afterEach(async () => {
            await config.teardownWrap!(wrap, effect);
          });
        }
      });
    };
  };
}

// MARK: EasyWrap
export interface InstanceWrapTestContextConfig<I, W extends AbstractWrappedFixtureWithInstance<I, F>, F> extends Pick<WrapTestContextConfig<W, F>, 'wrapFixture'> {
  /**
   * Creates a new instance for the tests.
   */
  makeInstance: (wrap: W) => I | Promise<I>;

  /**
   * Use for doing any setup that may be required on a per-test basis.
   *
   * This occurs before every test, but after the fixture's instance has already been configured.
   */
  setupInstance?: (instance: I, wrap: W) => void | Promise<void>;

  /**
   * Use for cleaning up the instance before the next function.
   *
   * This occurs after every test, but after the fixture's instance has already been configured.
   */
  teardownInstance?: (instance: I) => void | Promise<void>;
}

export function instanceWrapTestContextFactory<I, W extends AbstractWrappedFixtureWithInstance<I, F>, F>(config: InstanceWrapTestContextConfig<I, W, F>): (factory: TestContextFactory<F>) => TestContextFactory<W> {
  return wrapTestContextFactory<W, F, TestContextFixtureClearInstanceFunction>({
    wrapFixture: config.wrapFixture,
    setupWrap: async (wrap: W) => {
      const instance = await config.makeInstance(wrap);
      const effect = wrap.setInstance(instance);

      if (config.setupInstance) {
        await config.setupInstance(instance, wrap);
      }

      return effect;
    },
    teardownWrap: async (wrap: W, deleteInstanceEffect: TestContextFixtureClearInstanceFunction) => {
      deleteInstanceEffect?.();

      if (config.teardownInstance) {
        await config.teardownInstance(wrap.instance);
      }
    }
  });
}
