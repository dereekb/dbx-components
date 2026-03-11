import { Maybe, type PromiseOrValue, type PromiseReference, promiseReference } from '@dereekb/util';

// MARK: Test Done Callback
/**
 * A done callback function used by test frameworks to signal that a test has completed.
 *
 * Most modern test frameworks have deprecated the "done" callback in favor of async/await.
 */
export type TestDoneCallback = ((...args: any[]) => any) & {
  /**
   * NOTE: Not available in all test frameworks, but here for legacy purposes.
   *
   * @param error
   */
  fail(error?: string | { message: string }): any;
};

/**
 * Passes the error to the TestDoneCallback.
 * @param done - the test framework's done callback to signal completion or failure
 * @param e - the error to pass to the callback; defaults to a generic error
 */
export function failWithTestDoneCallback(done: TestDoneCallback, e: unknown = new Error('failed test')) {
  if (done.fail != null) {
    done.fail(e as Error);
  } else {
    done(e);
  }
}

/**
 * A test function that receives a done callback to signal completion.
 */
export type TestProvidesCallbackWithDone = (cb: TestDoneCallback) => void | undefined;

/**
 * A test function that either uses a done callback or returns a promise to signal completion.
 */
export type TestProvidesCallback = TestProvidesCallbackWithDone | (() => Promise<unknown>);

/**
 * Reference wrapper around a {@link TestDoneCallback} that exposes the underlying promise,
 * allowing callers to await the done signal.
 */
export type TestDoneCallbackRef = Omit<TestDoneCallback, 'fail'> & {
  readonly _promise: PromiseReference<void>;
  readonly done: TestDoneCallback;
};

/**
 * Creates a new TestDoneCallbackRef.
 *
 * Used to create a promise reference that can be used to assert that a test function was called.
 */
export function testDoneCallbackRef(): TestDoneCallbackRef {
  const _promise = promiseReference<void>();

  const done: TestDoneCallback = (e?: any) => {
    if (e) {
      _promise.reject(e);
    } else {
      _promise.resolve();
    }
  };

  done.fail = done;

  return {
    _promise,
    done
  };
}

/**
 * Wraps a callback-based test (using done) for Vitest compatibility.
 * Converts the callback pattern to a Promise-based pattern.
 *
 * This also supports calling the input test with async, but still only returns when done is called.
 *
 * @example
 *
 * // Before (Jasmine/Jest style):
 * it('test name', (done) => {
 *   // async test code
 *   done();
 * });
 *
 * // After (Vitest compatible):
 * it('test name', callbackTest((done) => {
 *   // async test code
 *   done();
 * }));
 */
export function callbackTest(testFn: TestProvidesCallbackWithDone | ((cb: TestDoneCallback) => PromiseOrValue<void | undefined>)): () => Promise<void> {
  return async () => {
    const done = testDoneCallbackRef();
    await testFn(done.done);
    return done._promise.promise;
  };
}

/**
 * A fixture instance that is generated new for each test run.
 */
export type TestFixtureInstance<I> = I;

/**
 * The test fixture is used as a singleton across tests used in a single context.
 *
 * This allows us to define tests while referencing the instance.
 */
export interface TestFixture<I> {
  readonly instance: TestFixtureInstance<I>;
}

/**
 * Cleanup function returned by {@link TestContextFixture.setInstance} to clear the current instance after a test completes.
 */
export type TestContextFixtureClearInstanceFunction = () => void;

/**
 * TestFixture with additional functions that the TestContextFactory sees for managing the instance.
 *
 * The fixture is used as a reference point for the Instance that is changed between each test.
 */
export interface TestContextFixture<I> extends TestFixture<I> {
  /**
   * Sets the instance before the tests run, and returns a function to clean the instance later.
   *
   * If called again before the instance is finished being used, this should throw an exception.
   *
   * @param instance
   */
  setInstance(instance: I): TestContextFixtureClearInstanceFunction;
}

/**
 * Abstract TestContextFixture instance.
 */
export abstract class AbstractTestContextFixture<I> implements TestContextFixture<I> {
  private _instance?: I;

  get instance(): I {
    return this._instance!;
  }

  setInstance(instance: I): TestContextFixtureClearInstanceFunction {
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
 * Abstract TestContextFixture instance with a parent.
 */
export abstract class AbstractChildTestContextFixture<I, P extends TestContextFixture<any>> extends AbstractTestContextFixture<I> {
  constructor(readonly parent: P) {
    super();
  }
}

/**
 * Function that declares tests using the provided fixture. Called during test suite setup
 * to register test cases that will later run against fresh fixture instances.
 */
export type BuildTestsWithContextFunction<F> = (fixture: F) => void;

/**
 * Used for tests to execute a number of tests using the fixture.
 *
 * The fixture is automatically setup and torn down each test per the configuration with a clean fixture instance.
 */
export type TestContextFactory<F> = (buildTests: BuildTestsWithContextFunction<F>) => void;

/**
 * Used to configure a TestContextFactory for building tests.
 */
export type TestContextBuilderFunction<I, F extends TestContextFixture<I>, C> = (config?: Partial<C>) => TestContextFactory<F>;

export interface TestContextBuilderConfig<I, F extends TestContextFixture<I>, C> {
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
 * Creates a TestContextBuilderFunction given the input builder.
 *
 * @param builder - configuration defining how to build configs, fixtures, and manage instance lifecycle
 * @returns a builder function that accepts optional partial config and produces a {@link TestContextFactory}
 */
export function testContextBuilder<I, F extends TestContextFixture<I>, C>(builder: TestContextBuilderConfig<I, F, C>): TestContextBuilderFunction<I, F, C> {
  return (inputConfig?: Partial<C>) => {
    const config = builder.buildConfig(inputConfig);

    return (buildTests: BuildTestsWithContextFunction<F>) => {
      const fixture = builder.buildFixture(config);

      // add before each
      if (builder.beforeEach != null) {
        beforeEach(builder.beforeEach);
      }

      // add tests
      useTestContextFixture({
        fixture,
        /**
         * Build tests by passing the fixture to the testing functions.
         *
         * This will inject all tests and sub lifecycle items.
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

/**
 * Configuration for {@link useTestContextFixture} that defines how to initialize and destroy
 * test instances, along with the fixture and test-building function.
 */
export interface UseContextFixture<C extends TestContextFixture<I>, I> {
  readonly fixture: C;
  readonly buildTests: BuildTestsWithContextFunction<C>;
  initInstance(): PromiseOrValue<I>;
  destroyInstance?(instance: I): PromiseOrValue<void>;
}

/**
 * Registers beforeEach/afterEach hooks that manage instance lifecycle for a test context fixture.
 *
 * Before each test, a new instance is created and set on the fixture. After each test, the instance
 * is cleared and optionally destroyed. Test declarations happen synchronously between the hooks.
 *
 * @param config - fixture, test builder, and instance lifecycle functions
 */
export function useTestContextFixture<C extends TestContextFixture<I>, I>(config: UseContextFixture<C, I>): void {
  const { buildTests, fixture, initInstance, destroyInstance } = config;

  let clearInstance: Maybe<TestContextFixtureClearInstanceFunction> = null;
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

    if (destroyInstance && instance != null) {
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
