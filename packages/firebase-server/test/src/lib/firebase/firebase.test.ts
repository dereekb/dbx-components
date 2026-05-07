import { type ClassLikeType, type ServerError } from '@dereekb/util';
import { type ExpectFailAssertionFunction, ExpectedErrorOfSpecificTypeError } from '@dereekb/util/test';
import { HttpsError } from 'firebase-functions/https';
import { BaseError } from 'make-error';

/**
 * Error thrown when the error type was different than the expected type.
 */
export class ExpectedHttpErrorWithSpecificServerErrorCode extends BaseError {
  constructor(
    readonly httpError: HttpsError,
    readonly expectedErrorCode: string
  ) {
    const { code } = httpError.details as ServerError;
    super(`Expected HttpError with an error code of "${expectedErrorCode}", but recieved "${code}" instead.`);
  }
}

/**
 * Creates a ExpectFailAssertionFunction that asserts the encountered error is of the expected type using the instanceof keyword.
 *
 * Throws a ExpectedErrorOfSpecificTypeError if the input is not a HttpsError.
 * Throws a ExpectedHttpErrorWithSpecificServerErrorCode if the input's server error data has a different error code.
 *
 * @param expectedCode - The server error code (from the {@link ServerError} carried in `HttpsError.details`) that the caught error must match.
 * @returns An assertion function suitable for use with `ExpectFailAssertionFunction` that verifies both the error type and its server error code.
 */
export function expectFailAssertHttpErrorServerErrorCode(expectedCode: string): ExpectFailAssertionFunction {
  return (error) => {
    if (error instanceof HttpsError) {
      const { code } = error.details as ServerError;

      if (code !== expectedCode) {
        throw new ExpectedHttpErrorWithSpecificServerErrorCode(error, expectedCode);
      }
    } else {
      throw new ExpectedErrorOfSpecificTypeError(error, HttpsError as ClassLikeType);
    }

    return true;
  };
}

// MARK: Compat
/**
 * @deprecated Use ExpectedHttpErrorWithSpecificServerErrorCode from shared instead. This is kept for backwards compatibility.
 */
export class JestExpectedHttpErrorWithSpecificServerErrorCode extends ExpectedHttpErrorWithSpecificServerErrorCode {}

/**
 * @deprecated Use expectFailAssertHttpErrorServerErrorCode from shared instead. This is kept for backwards compatibility.
 */
export const jestExpectFailAssertHttpErrorServerErrorCode = expectFailAssertHttpErrorServerErrorCode;
