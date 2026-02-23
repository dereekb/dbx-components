import { AbstractVitestTestContextFixture, type VitestBuildTestsWithContextFunction, type VitestTestContextFactory, type VitestTestContextFixtureClearInstanceFunction } from './vitest';

export abstract class AbstractWrappedFixture<F> {
  constructor(readonly fixture: F) {}
}

export abstract class AbstractWrappedFixtureWithInstance<I, F> extends AbstractVitestTestContextFixture<I> {
  constructor(readonly parent: F) {
    super();
  }
}

/**
 * Used to wrap a VitestTestContextFactory of one fixture type to another.
 *
 * This is useful for cases where the base fixture may be used in a lot of places and contexts, but the wrapped version can configure
 * tests more specifically.
 */
export type VitestTestWrappedContextFactoryBuilder<W, F> = (factory: VitestTestContextFactory<F>) => VitestTestContextFactory<W>;

export interface VitestWrapTestContextConfig<W, F, E = any> {
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
 * Wraps the input VitestTestContextFactory to emit another type of Fixture for tests.
 *
 * @returns
 */
export function wrapVitestTestContextFactory<W, F, E = any>(config: VitestWrapTestContextConfig<W, F, E>): (factory: VitestTestContextFactory<F>) => VitestTestContextFactory<W> {
  return (factory: VitestTestContextFactory<F>) => {
    return (buildTests: VitestBuildTestsWithContextFunction<W>) => {
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

// MARK EasyWrap
export interface InstanceVitestWrapTestContextConfig<I, W extends AbstractWrappedFixtureWithInstance<I, F>, F> extends Pick<VitestWrapTestContextConfig<W, F>, 'wrapFixture'> {
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

export function instanceWrapVitestTestContextFactory<I, W extends AbstractWrappedFixtureWithInstance<I, F>, F>(config: InstanceVitestWrapTestContextConfig<I, W, F>): (factory: VitestTestContextFactory<F>) => VitestTestContextFactory<W> {
  return wrapVitestTestContextFactory<W, F, VitestTestContextFixtureClearInstanceFunction>({
    wrapFixture: config.wrapFixture,
    setupWrap: async (wrap: W) => {
      const instance = await config.makeInstance(wrap);
      const effect = wrap.setInstance(instance);

      if (config.setupInstance) {
        await config.setupInstance(instance, wrap);
      }

      return effect;
    },
    teardownWrap: async (wrap: W, deleteInstanceEffect: VitestTestContextFixtureClearInstanceFunction) => {
      deleteInstanceEffect?.();

      if (config.teardownInstance) {
        await config.teardownInstance(wrap.instance);
      }
    }
  });
}
