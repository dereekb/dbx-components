import { firebaseServerErrorInfo } from './error';
import { phoneNumberAlreadyExistsError } from './error.auth';

describe('isFirebaseHttpsError()', () => {
  it('should handle the HttpsError properly', () => {
    const e = phoneNumberAlreadyExistsError();
    const result = firebaseServerErrorInfo(e);

    expect(result.type).toBe('httpsError');
  });
});

describe('firebaseServerErrorInfo()', () => {
  describe('HttpsError', () => {
    it('should handle the HttpsError properly', () => {
      const e = phoneNumberAlreadyExistsError();
      const result = firebaseServerErrorInfo(e);

      expect(result.type).toBe('httpsError');
      expect(result.httpsError).toBeDefined();
      expect(result.serverErrorCode).toBe('PHONE_NUMBER_ALREADY_EXISTS');
    });
  });
});
