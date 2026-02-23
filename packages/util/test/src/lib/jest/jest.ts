import { type PromiseOrValue } from '@dereekb/util';

/**
 * A fixture instance that is generated new for each test run.
 */
export type JestTestFixtureInstance<I> = I;

/**
 * The test fixture is used as a singleton across tests used in a single context.
 *
 * This allows us to define tests while referencing the instance.
 */
export interface JestTestFixture<I> {
  readonly instance: JestTestFixtureInstance<I>;
}

export type JestTestContextFixtureClearInstanceFunction = () => void;

/**
 * JestTestFixture with additional functions that the JestTestContextFactory sees for managing the instance.
 *
 * The fixture is used as a refernce point for the Instance that is changed between each test.
 */
export interface JestTestContextFixture<I> extends JestTestFixture<I> {
  /**
   * Sets the instance before the tests run, and returns a function to clean the instance later.
   *
   * If called again before the instance is finished being used, this should thrown an exception.
   *
   * @param instance
   */
  setInstance(instance: I): JestTestContextFixtureClearInstanceFunction;
}

/**
 * Abstract JestTestContextFixture instance.
 */
export abstract class AbstractJestTestContextFixture<I> implements JestTestContextFixture<I> {
  private _instance?: I;

  get instance(): I {
    return this._instance!;
  }

  setInstance(instance: I): JestTestContextFixtureClearInstanceFunction {
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
 * Abstract JestTestContextFixture instance with a parent.
 */
export abstract class AbstractChildJestTestContextFixture<I, P extends JestTestContextFixture<any>> extends AbstractJestTestContextFixture<I> {
  constructor(readonly parent: P) {
    super();
  }
}

export type JestBuildTestsWithContextFunction<F> = (fixture: F) => void;

/**
 * Used for Jest tests to execute a number of tests using the fixture.
 *
 * The fixture is automatically setup and torn down each test per the configuration with a clean fixture instance.
 */
export type JestTestContextFactory<F> = (buildTests: JestBuildTestsWithContextFunction<F>) => void;

/**
 * Used to configure a JestTestContextFactory for building tests.
 */
export type JestTestContextBuilderFunction<I, F extends JestTestContextFixture<I>, C> = (config?: Partial<C>) => JestTestContextFactory<F>;

export interface JestTestContextBuilderConfig<I, F extends JestTestContextFixture<I>, C> {
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
 * Creates a JestTestContextBuilderFunction given the input builder.
 *
 * @param builder
 * @returns
 */
export function jestTestContextBuilder<I, F extends JestTestContextFixture<I>, C>(builder: JestTestContextBuilderConfig<I, F, C>): JestTestContextBuilderFunction<I, F, C> {
  return (inputConfig?: Partial<C>) => {
    const config = builder.buildConfig(inputConfig);

    return (buildTests: JestBuildTestsWithContextFunction<F>) => {
      const fixture = builder.buildFixture(config);

      // add before each
      if (builder.beforeEach != null) {
        beforeEach(builder.beforeEach);
      }

      // add tests
      useJestContextFixture({
        fixture,
        /**
         * Build tests by passing the fixture to the testing functions.
         *
         * This will inject all tests and sub Jest lifecycle items.
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

export interface UseJestContextFixture<C extends JestTestContextFixture<I>, I> {
  readonly fixture: C;
  readonly buildTests: JestBuildTestsWithContextFunction<C>;
  initInstance(): PromiseOrValue<I>;
  destroyInstance?(instance: I): PromiseOrValue<void>;
}

/**
 * Creates a test context and jest configurations that will initialize an instance
 */
export function useJestContextFixture<C extends JestTestContextFixture<I>, I>(config: UseJestContextFixture<C, I>): void {
  const { buildTests, fixture, initInstance, destroyInstance } = config;

  let clearInstance: JestTestContextFixtureClearInstanceFunction;
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
