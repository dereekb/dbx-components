import { type PromiseOrValue, PromiseReference, promiseReference } from '@dereekb/util';

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
 * @param done
 * @param e
 */
export function failWithTestDoneCallback(done: TestDoneCallback, e: unknown = new Error('failed test')) {
  if (done.fail != null) {
    done.fail(e as Error);
  } else {
    done(e);
  }
}

export type TestProvidesCallbackWithDone = (cb: TestDoneCallback) => void | undefined;
export type TestProvidesCallback = TestProvidesCallbackWithDone | (() => Promise<unknown>);

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
export function callbackTest(testFn: TestProvidesCallbackWithDone): () => Promise<void> {
  return async () => {
    const done = testDoneCallbackRef();
    testFn(done.done);
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
 * @param builder
 * @returns
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
      useContextFixture({
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

export interface UseContextFixture<C extends TestContextFixture<I>, I> {
  readonly fixture: C;
  readonly buildTests: BuildTestsWithContextFunction<C>;
  initInstance(): PromiseOrValue<I>;
  destroyInstance?(instance: I): PromiseOrValue<void>;
}

/**
 * Creates a test context and configurations that will initialize an instance
 */
export function useContextFixture<C extends TestContextFixture<I>, I>(config: UseContextFixture<C, I>): void {
  const { buildTests, fixture, initInstance, destroyInstance } = config;

  let clearInstance: TestContextFixtureClearInstanceFunction;
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
