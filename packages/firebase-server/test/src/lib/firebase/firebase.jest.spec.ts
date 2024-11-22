import { ALREADY_EXISTS_ERROR_CODE, UNAVAILABLE_ERROR_CODE, unavailableError } from '@dereekb/firebase-server';
import { JestExpectedHttpErrorWithSpecificServerErrorCode, jestExpectFailAssertHttpErrorServerErrorCode } from './firebase.jest';
import { JestExpectedErrorOfSpecificTypeError, expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';

describe('jestExpectFailAssertHttpErrorServerErrorCode()', () => {
  it('should return true if the input is an HttpsError with ServerError details with the expected code', () => {
    const error = unavailableError('test');
    const instance = jestExpectFailAssertHttpErrorServerErrorCode(UNAVAILABLE_ERROR_CODE);

    const result = instance(error);
    expect(result).toBe(true);
  });

  itShouldFail('if the input error is an HttpsError with ServerError with a different error code', () => {
    const error = unavailableError('test');
    const instance = jestExpectFailAssertHttpErrorServerErrorCode(ALREADY_EXISTS_ERROR_CODE); // different error code than expected

    expectFail(() => instance(error), jestExpectFailAssertErrorType(JestExpectedHttpErrorWithSpecificServerErrorCode));
  });

  itShouldFail('if the input error is not an HttpsError', () => {
    const error = new Error();
    const instance = jestExpectFailAssertHttpErrorServerErrorCode(UNAVAILABLE_ERROR_CODE);

    expectFail(() => instance(error), jestExpectFailAssertErrorType(JestExpectedErrorOfSpecificTypeError));
  });
});
