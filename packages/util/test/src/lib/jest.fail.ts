/**
 * https://github.com/facebook/jest/issues/11698
 *
 * Since fail() was silently removed, we redefine it.
 */

import { Building, isPromise, promiseReference, PromiseReference, PromiseOrValue, build, ClassType, Maybe, ClassLikeType } from '@dereekb/util';
import { BaseError, Constructor } from 'make-error';

// MARK: Types
export interface JestDoneCallback {
  (...args: any[]): any;
  /**
   * NOTE: Not typically available in Jest, but here for legacy purposes.
   *
   * @param error
   */
  fail(error?: string | { message: string }): any;
}

/**
 * Passes the error to the JestDoneCallback.
 * @param done
 * @param e
 */
export function failWithJestDoneCallback(done: JestDoneCallback, e: unknown = new Error('failed test')) {
  if (done.fail != null) {
    done.fail(e as Error);
  } else {
    done(e);
  }
}

export type JestProvidesCallbackWithDone = (cb: JestDoneCallback) => void | undefined;
export type JestProvidesCallback = JestProvidesCallbackWithDone | (() => Promise<unknown>);

// MARK: Errors
/**
 * Error thrown by fail() and used by expectError()
 */
export class JestExpectedFailError extends BaseError {}

export function failSuccessfullyError(message?: string): JestExpectedFailError {
  return new JestExpectedFailError(message);
}

export function failSuccessfully(message?: string): never {
  throw failSuccessfullyError(message);
}

/**
 * Error thrown when success occurs when it should not have.
 */
export class JestUnexpectedSuccessFailureError extends BaseError {}

export function failDueToSuccessError(message?: string): JestUnexpectedSuccessFailureError {
  return new JestUnexpectedSuccessFailureError(message ?? 'expected an error to occur but was successful instead');
}

/**
 * Error thrown when the error type was different than the expected type.
 */
export class JestExpeectedErrorOfSpecificTypeError extends BaseError {
  constructor(encounteredType: unknown, expectedType?: Maybe<ClassLikeType | string>) {
    super(`The error encountered was not of the expected type. Expected: ${expectedType ?? 'n/a'}, but encountered: ${encounteredType} `);
  }
}

export function failTest(message?: string): never {
  throw failDueToSuccessError(message);
}

export function failDueToSuccess(): never {
  throw failDueToSuccessError();
}

export function failWithDoneDueToSuccess(done: JestDoneCallback): void {
  failWithJestDoneCallback(done, failDueToSuccessError());
}

export function EXPECT_ERROR_DEFAULT_HANDLER(e: unknown) {
  if (e instanceof JestExpectedFailError) {
    // success
  } else {
    throw e;
  }
}

// MARK: Expect Fail
/**
 * Used to assert additional information about the expected error.
 *
 * Can assert within this function, or return a boolean. A boolean returning false means the test should throw a JestExpeectedErrorOfSpecificTypeError.
 */
export type JestExpectFailAssertionFunction = (error: unknown) => PromiseOrValue<Maybe<boolean> | void>;

/**
 * Creates a JestExpeectedErrorOfSpecificTypeError that asserts the encountered error is of the expected type using the instanceof keyword.
 *
 * @param expectedType
 * @returns
 */
export function jestExpectFailAssertErrorType(expectedType: ClassType | ClassLikeType | typeof Error | any): JestExpectFailAssertionFunction {
  return (error: unknown) => {
    if (!(error instanceof expectedType)) {
      throw new JestExpeectedErrorOfSpecificTypeError(error, expectedType);
    }
  };
}

/**
 * Function that expects any failure to be thrown, then throws a JestExpectedFailError.
 *
 * @param errorFn
 * @param handleError
 */
export function expectFail(errorFn: () => void, assertFailType?: JestExpectFailAssertionFunction): void;
export function expectFail(errorFn: () => Promise<void>, assertFailType?: JestExpectFailAssertionFunction): Promise<void>;
export function expectFail<R extends PromiseOrValue<void>>(errorFn: () => R, assertFailType?: JestExpectFailAssertionFunction): PromiseOrValue<void> {
  function handleError(e: unknown) {
    if (e instanceof JestUnexpectedSuccessFailureError) {
      throw e;
    } else {
      const assertionResult = assertFailType?.(e);

      if (assertionResult === false) {
        throw new JestExpeectedErrorOfSpecificTypeError(e);
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

// MARK: ShouldFail
export interface JestShouldFailDoneCallback extends JestDoneCallback {
  failSuccessfully(): void;
}

export type JestShouldFailProvidesCallbackWithDone = (cb: JestShouldFailDoneCallback) => void | undefined;
export type JestShouldFailProvidesCallbackWithResult = () => PromiseOrValue<unknown>;
export type JestShouldFailProvidesCallback = JestShouldFailProvidesCallbackWithDone | JestShouldFailProvidesCallbackWithResult;

/**
 * Used to wrap a Jest testing function and watch for JestExpectedFailError errors in order to pass the test. Other exceptions are treated normally as failures.
 *
 * This is typically used in conjunction with failSuccessfully(), expectSuccessfulFail(), or expectFail().
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
        failWithJestDoneCallback(done, e);
      } else {
        done();
      }
    }

    expectSuccessfulFail(() => {
      let result: PromiseOrValue<any>;

      if (usesDoneCallback) {
        const fakeDone = build<JestShouldFailDoneCallback & JestFakeDoneHandler>({
          base: fakeDoneHandler(),
          build: (x) => {
            x.failSuccessfully = () => {
              (fakeDone as JestFakeDoneHandler)(failSuccessfullyError());
            };
          }
        });

        const callbackWithDoneResult = (fn as JestProvidesCallbackWithDone)(fakeDone as unknown as JestShouldFailDoneCallback);

        if (isPromise(callbackWithDoneResult)) {
          fakeDone.reject(new Error('Configured to use "done" value while returning a promise. Configure your test to use one or the other.'));
        }

        // return the fake done promise. Done/fail will resolve as a promise.
        result = fakeDone._ref.promise;
      } else {
        result = (fn as JestShouldFailProvidesCallbackWithResult)();
      }

      return result;
    }, handleError);
  };
}

// MARK: It
export function itShouldFail(fn: JestShouldFailProvidesCallback): void;
export function itShouldFail(describe: string, fn: JestShouldFailProvidesCallback): void;
export function itShouldFail(describeOrFn: string | JestShouldFailProvidesCallback, fn?: JestShouldFailProvidesCallback): void {
  let description;

  if (typeof describeOrFn === 'string') {
    description = `should fail ${describeOrFn}`;
  } else {
    fn = describeOrFn;
    description = 'should fail';
  }

  it(description, shouldFail(fn as JestShouldFailProvidesCallback));
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
