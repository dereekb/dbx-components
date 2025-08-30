import { ClassLikeType, ServerError } from '@dereekb/util';
import { JestExpectFailAssertionFunction, JestExpectedErrorOfSpecificTypeError } from '@dereekb/util/test';
import { HttpsError } from 'firebase-functions/v1/https';
import { BaseError } from 'make-error';

/**
 * Error thrown when the error type was different than the expected type.
 */
export class JestExpectedHttpErrorWithSpecificServerErrorCode extends BaseError {
  constructor(
    readonly httpError: HttpsError,
    readonly expectedErrorCode: string
  ) {
    const { code } = httpError.details as ServerError;
    super(`Expected HttpError with an error code of "${expectedErrorCode}", but recieved "${code}" instead.`);
  }
}

/**
 * Creates a JestExpectFailAssertionFunction that asserts the encountered error is of the expected type using the instanceof keyword.
 *
 * Throws a JestExpectedErrorOfSpecificTypeError if the input is not a HttpsError.
 * Throws a JestExpectedHttpErrorWithSpecificServerErrorCode if the input's server error data has a different error code.
 *
 * @param expectedType
 * @returns
 */
export function jestExpectFailAssertHttpErrorServerErrorCode(expectedCode: string): JestExpectFailAssertionFunction {
  return (error) => {
    if (error instanceof HttpsError) {
      const { code } = error.details as ServerError;

      if (code !== expectedCode) {
        throw new JestExpectedHttpErrorWithSpecificServerErrorCode(error, expectedCode);
      }
    } else {
      throw new JestExpectedErrorOfSpecificTypeError(error, HttpsError as ClassLikeType);
    }

    return true;
  };
}
