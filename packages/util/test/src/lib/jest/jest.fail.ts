/**
 * https://github.com/facebook/jest/issues/11698
 *
 * Since fail() was silently removed, we redefine it.
 */

import { type TestDoneCallback, failWithTestDoneCallback, type TestProvidesCallbackWithDone, type TestProvidesCallback } from '../shared';
import {
  ExpectedFailError,
  failSuccessfullyError,
  failSuccessfully,
  UnexpectedSuccessFailureError,
  failDueToSuccessError,
  ExpectedErrorOfSpecificTypeError,
  failTest,
  failDueToSuccess,
  EXPECT_ERROR_DEFAULT_HANDLER,
  type ExpectFailAssertionFunction,
  expectFailAssertErrorType,
  expectFail,
  expectSuccessfulFail,
  type ShouldFailDoneCallback,
  type ShouldFailProvidesCallbackWithDone,
  type ShouldFailProvidesCallbackWithResult,
  type ShouldFailProvidesCallback,
  type FakeDoneHandler
} from '../shared/shared.fail';

// MARK: Types
/**
 * @deprecated Use TestDoneCallback from shared instead. This is kept for backwards compatibility.
 */
export type JestDoneCallback = TestDoneCallback;

/**
 * @deprecated Use failWithTestDoneCallback from shared instead. This is kept for backwards compatibility.
 */
export const failWithJestDoneCallback = failWithTestDoneCallback;

/**
 * @deprecated Use TestProvidesCallbackWithDone from shared instead. This is kept for backwards compatibility.
 */
export type JestProvidesCallbackWithDone = TestProvidesCallbackWithDone;

/**
 * @deprecated Use TestProvidesCallback from shared instead. This is kept for backwards compatibility.
 */
export type JestProvidesCallback = TestProvidesCallback;

// MARK: Errors
/**
 * @deprecated Use ExpectedFailError from shared instead. This is kept for backwards compatibility.
 */
export class JestExpectedFailError extends ExpectedFailError {}

/**
 * @deprecated Use UnexpectedSuccessFailureError from shared instead. This is kept for backwards compatibility.
 */
export class JestUnexpectedSuccessFailureError extends UnexpectedSuccessFailureError {}

/**
 * @deprecated Use ExpectedErrorOfSpecificTypeError from shared instead. This is kept for backwards compatibility.
 */
export class JestExpectedErrorOfSpecificTypeError extends ExpectedErrorOfSpecificTypeError {}

/**
 * @deprecated Use failWithTestDoneCallback with failDueToSuccessError from shared instead. This is kept for backwards compatibility.
 */
export function failWithDoneDueToSuccess(done: TestDoneCallback): void {
  failWithTestDoneCallback(done, failDueToSuccessError());
}

// Re-export shared functions and constants
export { failSuccessfullyError, failSuccessfully, failDueToSuccessError, failTest, failDueToSuccess, EXPECT_ERROR_DEFAULT_HANDLER };

// MARK: Expect Fail
/**
 * @deprecated Use ExpectFailAssertionFunction from shared instead. This is kept for backwards compatibility.
 */
export type JestExpectFailAssertionFunction = ExpectFailAssertionFunction;

/**
 * @deprecated Use expectFailAssertErrorType from shared instead. This is kept for backwards compatibility.
 */
export const jestExpectFailAssertErrorType = expectFailAssertErrorType;

// Re-export shared functions
export { expectFail, expectSuccessfulFail };

// MARK: ShouldFail
/**
 * @deprecated Use ShouldFailDoneCallback from shared instead. This is kept for backwards compatibility.
 */
export type JestShouldFailDoneCallback = ShouldFailDoneCallback;

/**
 * @deprecated Use ShouldFailProvidesCallbackWithDone from shared instead. This is kept for backwards compatibility.
 */
export type JestShouldFailProvidesCallbackWithDone = ShouldFailProvidesCallbackWithDone;

/**
 * @deprecated Use ShouldFailProvidesCallbackWithResult from shared instead. This is kept for backwards compatibility.
 */
export type JestShouldFailProvidesCallbackWithResult = ShouldFailProvidesCallbackWithResult;

/**
 * @deprecated Use ShouldFailProvidesCallback from shared instead. This is kept for backwards compatibility.
 */
export type JestShouldFailProvidesCallback = ShouldFailProvidesCallback;

// MARK: Fake Done
/**
 * @deprecated Use FakeDoneHandler from shared instead. This is kept for backwards compatibility.
 */
export type JestFakeDoneHandler = FakeDoneHandler;
