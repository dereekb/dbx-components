/**
 * https://github.com/facebook/jest/issues/11698
 *
 * Since fail() was silently removed, we redefine it.
 */

import { Building, isPromise, promiseReference, PromiseReference, PromiseOrValue } from '@dereekb/util';
import { BaseError } from 'make-error';

/**
 * Error thrown by fail() and used by expectError()
 */
export class JestExpectedFailError extends BaseError {}

export function failSuccessfullyError(message?: string) {
  return new JestExpectedFailError(message);
}

export function failSuccessfully(message?: string) {
  throw failSuccessfullyError(message);
}

/**
 * Error thrown when success occurs when it should not have.
 */
export class JestUnexpectedSuccessFailureError extends BaseError {}

export function failDueToSuccessError() {
  return new JestUnexpectedSuccessFailureError('expected an error to occur but was successful instead');
}

export function failDueToSuccess() {
  throw failDueToSuccessError();
}

export function EXPECT_ERROR_DEFAULT_HANDLER(e: unknown) {
  if (e instanceof JestExpectedFailError) {
    // success
  } else {
    throw e;
  }
}

/**
 * Function that expects any failure to be thrown, then throws a JestExpectedFailError.
 *
 * @param errorFn
 * @param handleError
 */
export function expectFail(errorFn: () => void): void;
export function expectFail(errorFn: () => Promise<void>): Promise<void>;
export function expectFail<R extends PromiseOrValue<void>>(errorFn: () => R): PromiseOrValue<void> {
  function handleError(e: unknown) {
    if (e instanceof JestUnexpectedSuccessFailureError) {
      throw e;
    } else {
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
 * Function that expects a JestExpectedFailError to be thrown.
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

interface JestDoneCallback {
  (...args: any[]): any;
  /**
   * NOTE: Not typically available in Jest, but here for legacy purposes.
   *
   * @param error
   */
  fail(error?: string | { message: string }): any;
}

export type JestProvidesCallbackWithDone = (cb: JestDoneCallback) => void | undefined;
export type JestProvidesCallback = JestProvidesCallbackWithDone | (() => Promise<unknown>);

interface JestShouldFailDoneCallback extends JestDoneCallback {
  failSuccessfully(): void;
}

export type JestShouldFailProvidesCallbackWithDone = (cb: JestShouldFailDoneCallback) => void | undefined;
export type JestShouldFailProvidesCallbackWithResult = () => PromiseOrValue<unknown>;
export type JestShouldFailProvidesCallback = JestProvidesCallbackWithDone | JestShouldFailProvidesCallbackWithResult;

/**
 * Used to wrap a Jest function and look for a specific failure.
 *
 * @param fn
 * @param strict
 * @returns
 */
export function shouldFail(fn: JestShouldFailProvidesCallback): JestProvidesCallback {
  const usesDoneCallback = fn.length > 0;

  return (done) => {
    function handleError(e: unknown) {
      if (!(e instanceof JestExpectedFailError)) {
        if (done.fail != null) {
          done.fail(e as Error);
        } else {
          done(e);
        }
      } else {
        done();
      }
    }

    function handleErrorDueToSuccess() {
      handleError(failDueToSuccessError());
    }

    expectSuccessfulFail(() => {
      let result: PromiseOrValue<any>;

      if (usesDoneCallback) {
        const fakeDone = fakeDoneHandler();
        result = (fn as JestProvidesCallbackWithDone)(fakeDone as JestDoneCallback);

        if (isPromise(result)) {
          throw new Error('Configured to use "done" value while returning a promise. Configure your test to use one or the other.');
        }

        // return the fake done promise. Done/fail will resolve as a promise.
        return fakeDone._ref.promise;
      } else {
        result = (fn as JestShouldFailProvidesCallbackWithResult)();

        if (isPromise(result)) {
          return result; // return the promise
        } else {
          // done, but did not fail
          handleErrorDueToSuccess();
        }
      }
    }, handleError);
  };
}

// MARK: It
export function itShouldFail(describe: string, fn: JestShouldFailProvidesCallback) {
  it(`should fail ${describe}`, shouldFail(fn));
}

// MARK: Fake Done
export interface JestFakeDoneHandler extends JestDoneCallback, PromiseReference {
  _ref: PromiseReference;
}

export function fakeDoneHandler(): JestFakeDoneHandler {
  const promiseRef = promiseReference();

  const doneHandler = promiseRef.resolve;
  const failHandler = (e: unknown) => {
    promiseRef.reject(e);
  };

  const fakeDone: Building<JestFakeDoneHandler> = (error?: string | { message: string }) => {
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

  return fakeDone as JestFakeDoneHandler;
}
