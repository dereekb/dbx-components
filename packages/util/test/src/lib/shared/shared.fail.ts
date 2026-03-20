/**
 * Testing utilities for handling expected failures and errors.
 */

import { type Building, isPromise, promiseReference, type PromiseReference, type PromiseOrValue, build, type ClassType, type Maybe, type ClassLikeType } from '@dereekb/util';
import { BaseError } from 'make-error';
import { failWithTestDoneCallback, testDoneCallbackRef, type TestProvidesCallbackWithDone, type TestDoneCallback } from './shared';

// MARK: Errors
/**
 * Error thrown by fail() and used by expectError()
 */
export class ExpectedFailError extends BaseError {}

/**
 * Creates an {@link ExpectedFailError} without throwing it, for use in deferred error handling.
 *
 * @param message - optional error message
 */
export function failSuccessfullyError(message?: string): ExpectedFailError {
  return new ExpectedFailError(message);
}

/**
 * Throws an {@link ExpectedFailError} to signal that a test reached the expected failure point.
 *
 * Used within {@link shouldFail} or {@link expectSuccessfulFail} to indicate that the expected
 * error path was taken successfully.
 *
 * @param message - optional error message
 */
export function failSuccessfully(message?: string): never {
  throw failSuccessfullyError(message);
}

/**
 * Error thrown when success occurs when it should not have.
 */
export class UnexpectedSuccessFailureError extends BaseError {}

/**
 * Creates an {@link UnexpectedSuccessFailureError} without throwing it.
 *
 * @param message - optional error message; defaults to a standard "expected an error" message
 */
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

/**
 * Fails the current test by throwing an {@link UnexpectedSuccessFailureError}.
 * Use when a code path should not have been reached.
 *
 * @param message - optional error message
 */
export function failTest(message?: string): never {
  throw failDueToSuccessError(message);
}

/**
 * Throws an {@link UnexpectedSuccessFailureError} with a default message.
 * Typically called when an operation succeeds but was expected to throw.
 */
export function failDueToSuccess(): never {
  throw failDueToSuccessError();
}

/**
 * Default error handler for {@link expectSuccessfulFail} that passes through {@link ExpectedFailError}
 * instances and re-throws all other errors.
 */
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
 * @param expectedType - the class or constructor function that the error should be an instance of
 * @returns an assertion function that validates the error type via instanceof
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
 * @param errorFn - function expected to throw an error (sync or async)
 * @param assertFailType - optional assertion to validate the type or content of the thrown error
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function expectFail(errorFn: () => PromiseOrValue<any>, assertFailType?: ExpectFailAssertionFunction): Promise<void> {
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
      return result.then(failDueToSuccess).catch(handleError) as Promise<void>;
    } else {
      failDueToSuccess();
    }
  } catch (e) {
    handleError(e);
  }

  return Promise.resolve();
}

/**
 * Function that expects an ExpectedFailError to be thrown.
 *
 * @param errorFn - function expected to throw (sync or async); if it succeeds, the test fails
 * @param handleError - optional custom error handler; defaults to {@link EXPECT_ERROR_DEFAULT_HANDLER}
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
/**
 * Extended done callback for {@link shouldFail} tests that adds a {@link failSuccessfully} convenience method.
 */
export interface ShouldFailDoneCallback extends TestDoneCallback {
  failSuccessfully(): void;
}

/**
 * A test function for {@link shouldFail} that receives a {@link ShouldFailDoneCallback} to signal failure outcomes.
 */
export type ShouldFailProvidesCallbackWithDone = (cb: ShouldFailDoneCallback) => void | undefined;

/**
 * A test function for {@link shouldFail} that returns its result directly (sync or async), without using a done callback.
 */
export type ShouldFailProvidesCallbackWithResult = () => PromiseOrValue<unknown>;

/**
 * Union type for test functions accepted by {@link shouldFail}. Supports both done-callback and promise-based patterns.
 */
export type ShouldFailProvidesCallback = ShouldFailProvidesCallbackWithDone | ShouldFailProvidesCallbackWithResult;

/**
 * Used to wrap a testing function and watch for ExpectedFailError errors in order to pass the test. Other exceptions are treated normally as failures.
 *
 * This is typically used in conjunction with failSuccessfully(), expectSuccessfulFail(), or expectFail().
 *
 * @param fn - the test function that is expected to throw an {@link ExpectedFailError}
 * @returns an async test function suitable for use with `it()`
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
/**
 * Convenience wrapper that registers an `it()` test case which is expected to fail.
 *
 * Automatically generates a "should fail" description and wraps the test function with {@link shouldFail}.
 *
 * @param describeOrFn - either a description suffix (e.g., "when input is null") or the test function directly
 * @param fn - the test function, if a description string was provided as the first argument
 */
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
/**
 * A simulated done callback that bridges callback-based test patterns to promises.
 *
 * Calling the handler or its `fail` method resolves or rejects the underlying promise,
 * allowing callback-style tests to be awaited.
 */
export interface FakeDoneHandler extends TestDoneCallback, PromiseReference {
  _ref: PromiseReference;
}

/**
 * Creates a {@link FakeDoneHandler} that converts done-callback invocations into promise resolution/rejection.
 *
 * Calling the returned function with no arguments resolves the promise;
 * calling it with an error (or calling `.fail()`) rejects the promise.
 */
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
