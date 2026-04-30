import { ALREADY_EXISTS_ERROR_CODE, UNAVAILABLE_ERROR_CODE } from '@dereekb/firebase';
import { unavailableError } from '@dereekb/firebase-server';
import { ExpectedHttpErrorWithSpecificServerErrorCode, expectFailAssertHttpErrorServerErrorCode } from './firebase.test';
import { ExpectedErrorOfSpecificTypeError, expectFail, itShouldFail, expectFailAssertErrorType } from '@dereekb/util/test';

describe('expectFailAssertHttpErrorServerErrorCode()', () => {
  it('should return true if the input is an HttpsError with ServerError details with the expected code', () => {
    const error = unavailableError('test');
    const instance = expectFailAssertHttpErrorServerErrorCode(UNAVAILABLE_ERROR_CODE);

    const result = instance(error);
    expect(result).toBe(true);
  });

  itShouldFail('if the input error is an HttpsError with ServerError with a different error code', async () => {
    const error = unavailableError('test');
    const instance = expectFailAssertHttpErrorServerErrorCode(ALREADY_EXISTS_ERROR_CODE); // different error code than expected

    await expectFail(() => instance(error), expectFailAssertErrorType(ExpectedHttpErrorWithSpecificServerErrorCode));
  });

  itShouldFail('if the input error is not an HttpsError', async () => {
    const error = new Error();
    const instance = expectFailAssertHttpErrorServerErrorCode(UNAVAILABLE_ERROR_CODE);

    await expectFail(() => instance(error), expectFailAssertErrorType(ExpectedErrorOfSpecificTypeError));
  });
});
