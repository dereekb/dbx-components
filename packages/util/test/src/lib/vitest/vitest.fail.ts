/**
 * Vitest testing utilities for handling expected failures and errors.
 */

import { type Building, isPromise, promiseReference, type PromiseReference, type PromiseOrValue, build, type ClassType, type Maybe, type ClassLikeType } from '@dereekb/util';
import { log } from 'console';
import { BaseError } from 'make-error';

// MARK: Types
export type VitestDoneCallback = ((...args: any[]) => any) & {
  /**
   * NOTE: Not available in Vitest, but here for legacy purposes.
   *
   * @param error
   */
  fail(error?: string | { message: string }): any;
};

/**
 * Passes the error to the VitestDoneCallback.
 * @param done
 * @param e
 */
export function failWithVitestDoneCallback(done: VitestDoneCallback, e: unknown = new Error('failed test')) {
  if (done.fail != null) {
    done.fail(e as Error);
  } else {
    done(e);
  }
}

/**
 * @deprecated Vitest has deprecated the "done" callback in favor of async/await.
 */
export type VitestProvidesCallbackWithDone = (cb: VitestDoneCallback) => void | undefined;
export type VitestProvidesCallback = VitestProvidesCallbackWithDone | (() => Promise<unknown>);

export type VitestDoneCallbackRef = Omit<VitestDoneCallback, 'fail'> & {
  readonly _promise: PromiseReference<void>;
  readonly done: VitestDoneCallback;
};

/**
 * Creates a new VitestDoneCallbackRef.
 *
 * Used to create a promise reference that can be used to assert that a test function was called.
 */
export function vitestDoneCallbackRef(): VitestDoneCallbackRef {
  const _promise = promiseReference<void>();

  const done: VitestDoneCallback = (e?: any) => {
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
export class VitestExpectedFailError extends BaseError {}

export function failSuccessfullyError(message?: string): VitestExpectedFailError {
  return new VitestExpectedFailError(message);
}

export function failSuccessfully(message?: string): never {
  throw failSuccessfullyError(message);
}

/**
 * Error thrown when success occurs when it should not have.
 */
export class VitestUnexpectedSuccessFailureError extends BaseError {}

export function failDueToSuccessError(message?: string): VitestUnexpectedSuccessFailureError {
  return new VitestUnexpectedSuccessFailureError(message ?? 'expected an error to occur but was successful instead');
}

/**
 * Error thrown when the error type was different than the expected type.
 */
export class VitestExpectedErrorOfSpecificTypeError extends BaseError {
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
  if (e instanceof VitestExpectedFailError) {
    // success
  } else {
    throw e;
  }
}

// MARK: Expect Fail
/**
 * Used to assert additional information about the expected error.
 *
 * Can assert within this function, or return a boolean. A boolean returning false means the test should throw a VitestExpectedErrorOfSpecificTypeError.
 */
export type VitestExpectFailAssertionFunction = (error: unknown) => PromiseOrValue<Maybe<boolean> | void>;

/**
 * Creates a VitestExpectFailAssertionFunction that asserts the encountered error is of the expected type using the instanceof keyword.
 *
 * Throws a VitestExpectedErrorOfSpecificTypeError on failures.
 *
 * @param expectedType
 * @returns
 */
export function vitestExpectFailAssertErrorType(expectedType: ClassType | ClassLikeType | typeof Error | any): VitestExpectFailAssertionFunction {
  return (error: unknown) => {
    if (!(error instanceof expectedType)) {
      throw new VitestExpectedErrorOfSpecificTypeError(error, expectedType);
    }
  };
}

/**
 * Function that expects any failure to be thrown, then throws a VitestExpectedFailError.
 *
 * @param errorFn
 * @param handleError
 */
export function expectFail(errorFn: () => void, assertFailType?: VitestExpectFailAssertionFunction): void;
export function expectFail(errorFn: () => Promise<void>, assertFailType?: VitestExpectFailAssertionFunction): Promise<void>;
export function expectFail<R extends PromiseOrValue<void>>(errorFn: () => R, assertFailType?: VitestExpectFailAssertionFunction): PromiseOrValue<void> {
  function handleError(e: unknown) {
    if (e instanceof VitestUnexpectedSuccessFailureError) {
      throw e;
    } else {
      const assertionResult = assertFailType?.(e);

      if (assertionResult === false) {
        throw new VitestExpectedErrorOfSpecificTypeError(e);
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
 * Function that expects a VitestExpectedFailError to be thrown.
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
export interface VitestShouldFailDoneCallback extends VitestDoneCallback {
  failSuccessfully(): void;
}

export type VitestShouldFailProvidesCallbackWithDone = (cb: VitestShouldFailDoneCallback) => void | undefined;
export type VitestShouldFailProvidesCallbackWithResult = () => PromiseOrValue<unknown>;
export type VitestShouldFailProvidesCallback = VitestShouldFailProvidesCallbackWithDone | VitestShouldFailProvidesCallbackWithResult;

/**
 * Used to wrap a Vitest testing function and watch for VitestExpectedFailError errors in order to pass the test. Other exceptions are treated normally as failures.
 *
 * This is typically used in conjunction with failSuccessfully(), expectSuccessfulFail(), or expectFail().
 *
 * @param fn
 * @param strict
 * @returns
 */
export function shouldFail(fn: VitestShouldFailProvidesCallback): () => Promise<unknown> {
  const usesDoneCallback = fn.length > 0;

  // Return a function that checks arguments at runtime to avoid Vitest's done callback deprecation warning
  return async function () {
    const { done, _promise } = vitestDoneCallbackRef();

    function handleError(e: unknown) {
      if (!(e instanceof VitestExpectedFailError)) {
        failWithVitestDoneCallback(done, e);
      } else {
        done();
      }
    }

    try {
      const result = expectSuccessfulFail(() => {
        let result: PromiseOrValue<any>;

        if (usesDoneCallback) {
          const fakeDone = build<VitestShouldFailDoneCallback & VitestFakeDoneHandler>({
            base: fakeDoneHandler(),
            build: (x) => {
              x.failSuccessfully = () => {
                (fakeDone as VitestFakeDoneHandler)(failSuccessfullyError());
              };
            }
          });

          const callbackWithDoneResult = (fn as VitestProvidesCallbackWithDone)(fakeDone as unknown as VitestShouldFailDoneCallback);

          if (isPromise(callbackWithDoneResult)) {
            fakeDone.reject(new Error('Configured to use "done" value while returning a promise. Configure your test to use one or the other.'));
          }

          // return the fake done promise. Done/fail will resolve as a promise.
          result = fakeDone._ref.promise;
        } else {
          result = (fn as VitestShouldFailProvidesCallbackWithResult)();
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
export function itShouldFail(fn: VitestShouldFailProvidesCallback): void;
export function itShouldFail(describe: string, fn: VitestShouldFailProvidesCallback): void;
export function itShouldFail(describeOrFn: string | VitestShouldFailProvidesCallback, fn?: VitestShouldFailProvidesCallback): void {
  let description;

  if (typeof describeOrFn === 'string') {
    description = `should fail ${describeOrFn}`;
  } else {
    fn = describeOrFn;
    description = 'should fail';
  }

  it(description, shouldFail(fn as VitestShouldFailProvidesCallback));
}

// MARK: Fake Done
export interface VitestFakeDoneHandler extends VitestDoneCallback, PromiseReference {
  _ref: PromiseReference;
}

export function fakeDoneHandler(): VitestFakeDoneHandler {
  const promiseRef = promiseReference();

  const doneHandler = promiseRef.resolve;
  const failHandler = (e: unknown) => {
    promiseRef.reject(e);
  };

  const fakeDone: Building<VitestFakeDoneHandler> = (error?: string | { message: string }) => {
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

  return fakeDone as VitestFakeDoneHandler;
}
