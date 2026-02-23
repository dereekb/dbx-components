import { type PromiseOrValue } from '@dereekb/util';

/**
 * A fixture instance that is generated new for each test run.
 */
export type VitestTestFixtureInstance<I> = I;

/**
 * The test fixture is used as a singleton across tests used in a single context.
 *
 * This allows us to define tests while referencing the instance.
 */
export interface VitestTestFixture<I> {
  readonly instance: VitestTestFixtureInstance<I>;
}

export type VitestTestContextFixtureClearInstanceFunction = () => void;

/**
 * VitestTestFixture with additional functions that the VitestTestContextFactory sees for managing the instance.
 *
 * The fixture is used as a refernce point for the Instance that is changed between each test.
 */
export interface VitestTestContextFixture<I> extends VitestTestFixture<I> {
  /**
   * Sets the instance before the tests run, and returns a function to clean the instance later.
   *
   * If called again before the instance is finished being used, this should thrown an exception.
   *
   * @param instance
   */
  setInstance(instance: I): VitestTestContextFixtureClearInstanceFunction;
}

/**
 * Abstract VitestTestContextFixture instance.
 */
export abstract class AbstractVitestTestContextFixture<I> implements VitestTestContextFixture<I> {
  private _instance?: I;

  get instance(): I {
    return this._instance!;
  }

  setInstance(instance: I): VitestTestContextFixtureClearInstanceFunction {
    if (this._instance != null) {
      throw new Error(`The testing fixture is locked. Don't call setInstance() directly.`);
    }

    this._instance = instance;

    return () => {
      delete this._instance;
    };
  }
}

/**
 * Abstract VitestTestContextFixture instance with a parent.
 */
export abstract class AbstractChildVitestTestContextFixture<I, P extends VitestTestContextFixture<any>> extends AbstractVitestTestContextFixture<I> {
  constructor(readonly parent: P) {
    super();
  }
}

export type VitestBuildTestsWithContextFunction<F> = (fixture: F) => void;

/**
 * Used for Vitest tests to execute a number of tests using the fixture.
 *
 * The fixture is automatically setup and torn down each test per the configuration with a clean fixture instance.
 */
export type VitestTestContextFactory<F> = (buildTests: VitestBuildTestsWithContextFunction<F>) => void;

/**
 * Used to configure a VitestTestContextFactory for building tests.
 */
export type VitestTestContextBuilderFunction<I, F extends VitestTestContextFixture<I>, C> = (config?: Partial<C>) => VitestTestContextFactory<F>;

export interface VitestTestContextBuilderConfig<I, F extends VitestTestContextFixture<I>, C> {
  /**
   * Builds a config given the optional, partial input config. This is used across all tests.
   */
  buildConfig: (config?: Partial<C>) => C;

  /**
   * Builds a new fixture to use across all encapsulated tests.
   */
  buildFixture: (config: C) => F;

  /**
   * Arbitrary before each function, called before the instance is setup.
   */
  beforeEach?: () => Promise<void>;

  /**
   * Use for building an instance.
   *
   * When the promise resolves it should be ready to be used by the test being executed.
   */
  setupInstance: (config: C) => Promise<I>;

  /**
   * Use for cleaning up the instance before the next test.
   */
  teardownInstance: (instance: I, config: C) => Promise<void>;

  /**
   * Arbitrary after each function.
   */
  afterEach?: () => Promise<void>;
}

/**
 * Creates a VitestTestContextBuilderFunction given the input builder.
 *
 * @param builder
 * @returns
 */
export function vitestTestContextBuilder<I, F extends VitestTestContextFixture<I>, C>(builder: VitestTestContextBuilderConfig<I, F, C>): VitestTestContextBuilderFunction<I, F, C> {
  return (inputConfig?: Partial<C>) => {
    const config = builder.buildConfig(inputConfig);

    return (buildTests: VitestBuildTestsWithContextFunction<F>) => {
      const fixture = builder.buildFixture(config);

      // add before each
      if (builder.beforeEach != null) {
        beforeEach(builder.beforeEach);
      }

      // add tests
      useVitestContextFixture({
        fixture,
        /**
         * Build tests by passing the fixture to the testing functions.
         *
         * This will inject all tests and sub Vitest lifecycle items.
         */
        buildTests,
        initInstance: () => builder.setupInstance(config),
        destroyInstance: (instance) => builder.teardownInstance(instance, config)
      });

      // add after each
      if (builder.afterEach != null) {
        afterEach(builder.afterEach);
      }
    };
  };
}

export interface UseVitestContextFixture<C extends VitestTestContextFixture<I>, I> {
  readonly fixture: C;
  readonly buildTests: VitestBuildTestsWithContextFunction<C>;
  initInstance(): PromiseOrValue<I>;
  destroyInstance?(instance: I): PromiseOrValue<void>;
}

/**
 * Creates a test context and vitest configurations that will initialize an instance
 */
export function useVitestContextFixture<C extends VitestTestContextFixture<I>, I>(config: UseVitestContextFixture<C, I>): void {
  const { buildTests, fixture, initInstance, destroyInstance } = config;

  let clearInstance: VitestTestContextFixtureClearInstanceFunction;
  let instance: I;

  // Create an instance
  beforeEach(async () => {
    try {
      instance = await initInstance();
      clearInstance = fixture.setInstance(instance);
    } catch (e) {
      console.error('Failed building a test instance due to an error in buildInstance(). Error: ', e);

      if (clearInstance) {
        clearInstance();
      }

      throw e;
    }
  });

  // Declare tests
  buildTests(fixture);

  // Cleanup
  afterEach(async () => {
    if (clearInstance) {
      clearInstance();
    }

    if (fixture.instance != null) {
      console.warn('Expected instance to be set on fixture for cleanup but was set to something else.');
    }

    if (destroyInstance) {
      try {
        await destroyInstance(instance);
        instance = undefined as any;
      } catch (e) {
        console.error('Failed due to error in destroyInstance()');
        throw e;
      }
    }
  });
}
