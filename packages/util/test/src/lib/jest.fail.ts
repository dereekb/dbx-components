/**
 * https://github.com/facebook/jest/issues/11698
 *
 * Since fail() was silently removed, we redefine it.
 */

import { Building, isPromise, promiseReference, PromiseReference, PromiseOrValue, PromiseUtility } from '@dereekb/util';
import { BaseError } from 'make-error';

export class JestShouldFailError extends BaseError {}

export function failError(message?: string) {
  return new JestShouldFailError(message);
}

export function fail(message?: string) {
  throw failError(message);
}

export function failDueToSuccessError() {
  return failError('expected an error to occur but was successful instead');
}

export function failDueToSuccess() {
  throw failDueToSuccessError();
}

export function EXPECT_ERROR_DEFAULT_HANDLER(e: unknown) {
  if (e instanceof JestShouldFailError) {
    throw e;
  } else {
    // success
  }
}

export function expectError(errorFn: () => void, handleError?: (e: unknown) => void): void;
export function expectError(errorFn: () => Promise<void>, handleError?: (e: unknown) => void): Promise<void>;
export function expectError<R extends PromiseOrValue<void>>(errorFn: () => R, handleError: (e: unknown) => void = EXPECT_ERROR_DEFAULT_HANDLER): PromiseOrValue<void> {
  try {
    const result = errorFn();

    if (isPromise(result)) {
      return result
        .then((x) => {
          failDueToSuccess();
        })
        .catch((e) => handleError(e));
    } else {
      failDueToSuccess();
    }
  } catch (e) {
    handleError(e);
  }
}

interface JestDoneCallback {
  (...args: any[]): any;
  fail(error?: string | { message: string }): any;
}

export type JestProvidesCallbackWithDone = (cb: JestDoneCallback) => void | undefined;
export type JestProvidesCallback = JestProvidesCallbackWithDone | (() => Promise<unknown>);

export function shouldFail(fn: JestProvidesCallback): JestProvidesCallback {
  const usesDoneCallback = fn.length > 0;

  return (done) => {
    function handleError(e: unknown) {
      try {
        EXPECT_ERROR_DEFAULT_HANDLER(e);
        done();
      } catch (e: unknown) {
        done.fail(e as JestShouldFailError);
      }
    }

    function handleErrorDueToSuccess() {
      handleError(failDueToSuccessError());
    }

    expectError(() => {
      let result: PromiseOrValue<any>;

      if (usesDoneCallback) {
        const fakeDone = fakeDoneHandler();
        result = (fn as JestProvidesCallbackWithDone)(fakeDone as JestDoneCallback);

        if (isPromise(result)) {
          throw new Error('Configured to use "done" value while returning a promise. Configure your test to use one or the other.');
        }

        // return the fake done promise. Done/fail will resolve as a promise.
        return fakeDone._ref.promise;
      } else if (isPromise(result)) {
        return result; // return the promise
      } else {
        // done, but did not fail
        handleErrorDueToSuccess();
      }
    }, handleError);
  };
}

// MARK: It
export function itShouldFail(describe: string, fn: JestProvidesCallback) {
  it(describe, shouldFail(fn));
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

  const fakeDone: Building<JestFakeDoneHandler> = () => {
    doneHandler(0); // call the done handler.
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
