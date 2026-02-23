/**
 * Testing utilities for handling expected failures and errors.
 */

import { type Building, isPromise, promiseReference, type PromiseReference, type PromiseOrValue, build, type ClassType, type Maybe, type ClassLikeType } from '@dereekb/util';
import { BaseError } from 'make-error';

// MARK: Types
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

/**
 * @deprecated Most modern test frameworks have deprecated the "done" callback in favor of async/await.
 */
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

// MARK: Errors
/**
 * Error thrown by fail() and used by expectError()
 */
export class ExpectedFailError extends BaseError {}

export function failSuccessfullyError(message?: string): ExpectedFailError {
  return new ExpectedFailError(message);
}

export function failSuccessfully(message?: string): never {
  throw failSuccessfullyError(message);
}

/**
 * Error thrown when success occurs when it should not have.
 */
export class UnexpectedSuccessFailureError extends BaseError {}

export function failDueToSuccessError(message?: string): UnexpectedSuccessFailureError {
  return new UnexpectedSuccessFailureError(message ?? 'expected an error to occur but was successful instead');
}

/**
 * Error thrown when the error type was different than the expected type.
 */
export class ExpectedErrorOfSpecificTypeError extends BaseError {
  constructor(
    readonly encounteredType: unknown,
    readonly expectedType?: Maybe<ClassLikeType | string>
  ) {
    super(`The error encountered was not of the expected type. Expected: ${expectedType ?? 'n/a'}, but encountered: ${encounteredType} `);
  }
}

export function failTest(message?: string): never {
  throw failDueToSuccessError(message);
}

export function failDueToSuccess(): never {
  throw failDueToSuccessError();
}

export function EXPECT_ERROR_DEFAULT_HANDLER(e: unknown) {
  if (e instanceof ExpectedFailError) {
    // success
  } else {
    throw e;
  }
}

// MARK: Expect Fail
/**
 * Used to assert additional information about the expected error.
 *
 * Can assert within this function, or return a boolean. A boolean returning false means the test should throw an ExpectedErrorOfSpecificTypeError.
 */
export type ExpectFailAssertionFunction = (error: unknown) => PromiseOrValue<Maybe<boolean> | void>;

/**
 * Creates an ExpectFailAssertionFunction that asserts the encountered error is of the expected type using the instanceof keyword.
 *
 * Throws an ExpectedErrorOfSpecificTypeError on failures.
 *
 * @param expectedType
 * @returns
 */
export function expectFailAssertErrorType(expectedType: ClassType | ClassLikeType | typeof Error | any): ExpectFailAssertionFunction {
  return (error: unknown) => {
    if (!(error instanceof expectedType)) {
      throw new ExpectedErrorOfSpecificTypeError(error, expectedType);
    }
  };
}

/**
 * Function that expects any failure to be thrown, then throws an ExpectedFailError.
 *
 * @param errorFn
 * @param handleError
 */
export function expectFail(errorFn: () => void, assertFailType?: ExpectFailAssertionFunction): void;
export function expectFail(errorFn: () => Promise<void>, assertFailType?: ExpectFailAssertionFunction): Promise<void>;
export function expectFail<R extends PromiseOrValue<void>>(errorFn: () => R, assertFailType?: ExpectFailAssertionFunction): PromiseOrValue<void> {
  function handleError(e: unknown) {
    if (e instanceof UnexpectedSuccessFailureError) {
      throw e;
    } else {
      const assertionResult = assertFailType?.(e);

      if (assertionResult === false) {
        throw new ExpectedErrorOfSpecificTypeError(e);
      }

      failSuccessfully();
    }
  }

  try {
    const result = errorFn();

    if (isPromise(result)) {
      return result.then(failDueToSuccess).catch(handleError);
    } else {
      failDueToSuccess();
    }
  } catch (e) {
    handleError(e);
  }
}

/**
 * Function that expects an ExpectedFailError to be thrown.
 *
 * @param errorFn
 * @param handleError
 */
export function expectSuccessfulFail(errorFn: () => void, handleError?: (e: unknown) => void): void;
export function expectSuccessfulFail(errorFn: () => Promise<void>, handleError?: (e: unknown) => void): Promise<void>;
export function expectSuccessfulFail<R extends PromiseOrValue<void>>(errorFn: () => R, handleError: (e: unknown) => void = EXPECT_ERROR_DEFAULT_HANDLER): PromiseOrValue<void> {
  try {
    const result = errorFn();

    if (isPromise(result)) {
      return result.then(failDueToSuccess).catch(handleError);
    } else {
      failDueToSuccess();
    }
  } catch (e) {
    handleError(e);
  }
}

// MARK: ShouldFail
export interface ShouldFailDoneCallback extends TestDoneCallback {
  failSuccessfully(): void;
}

export type ShouldFailProvidesCallbackWithDone = (cb: ShouldFailDoneCallback) => void | undefined;
export type ShouldFailProvidesCallbackWithResult = () => PromiseOrValue<unknown>;
export type ShouldFailProvidesCallback = ShouldFailProvidesCallbackWithDone | ShouldFailProvidesCallbackWithResult;

/**
 * Used to wrap a testing function and watch for ExpectedFailError errors in order to pass the test. Other exceptions are treated normally as failures.
 *
 * This is typically used in conjunction with failSuccessfully(), expectSuccessfulFail(), or expectFail().
 *
 * @param fn
 * @param strict
 * @returns
 */
export function shouldFail(fn: ShouldFailProvidesCallback): () => Promise<unknown> {
  const usesDoneCallback = fn.length > 0;

  // Return a function that checks arguments at runtime to avoid done callback deprecation warning
  return async function () {
    const { done, _promise } = testDoneCallbackRef();

    function handleError(e: unknown) {
      if (!(e instanceof ExpectedFailError)) {
        failWithTestDoneCallback(done, e);
      } else {
        done();
      }
    }

    try {
      const result = expectSuccessfulFail(() => {
        let result: PromiseOrValue<any>;

        if (usesDoneCallback) {
          const fakeDone = build<ShouldFailDoneCallback & FakeDoneHandler>({
            base: fakeDoneHandler(),
            build: (x) => {
              x.failSuccessfully = () => {
                (fakeDone as FakeDoneHandler)(failSuccessfullyError());
              };
            }
          });

          const callbackWithDoneResult = (fn as TestProvidesCallbackWithDone)(fakeDone as unknown as ShouldFailDoneCallback);

          if (isPromise(callbackWithDoneResult)) {
            fakeDone.reject(new Error('Configured to use "done" value while returning a promise. Configure your test to use one or the other.'));
          }

          // return the fake done promise. Done/fail will resolve as a promise.
          result = fakeDone._ref.promise;
        } else {
          result = (fn as ShouldFailProvidesCallbackWithResult)();
        }

        return result;
      }, handleError);

      // If expectSuccessfulFail returns a promise, handle it
      if (isPromise(result)) {
        result.catch(handleError);
      }
    } catch (e) {
      // Handle synchronous errors
      handleError(e);
    }

    return _promise.promise;
  };
}

// MARK: It
export function itShouldFail(fn: ShouldFailProvidesCallback): void;
export function itShouldFail(describe: string, fn: ShouldFailProvidesCallback): void;
export function itShouldFail(describeOrFn: string | ShouldFailProvidesCallback, fn?: ShouldFailProvidesCallback): void {
  let description;

  if (typeof describeOrFn === 'string') {
    description = `should fail ${describeOrFn}`;
  } else {
    fn = describeOrFn;
    description = 'should fail';
  }

  it(description, shouldFail(fn as ShouldFailProvidesCallback));
}

// MARK: Fake Done
export interface FakeDoneHandler extends TestDoneCallback, PromiseReference {
  _ref: PromiseReference;
}

export function fakeDoneHandler(): FakeDoneHandler {
  const promiseRef = promiseReference();

  const doneHandler = promiseRef.resolve;
  const failHandler = (e: unknown) => {
    promiseRef.reject(e);
  };

  const fakeDone: Building<FakeDoneHandler> = (error?: string | { message: string }) => {
    if (error) {
      failHandler(error);
    } else {
      doneHandler(0);
    }
  };

  fakeDone.fail = (error?: string | { message: string }) => {
    failHandler(error);
  };

  fakeDone._ref = promiseRef;
  fakeDone.promise = promiseRef.promise;
  fakeDone.resolve = promiseRef.resolve;
  fakeDone.reject = promiseRef.reject;

  return fakeDone as FakeDoneHandler;
}
