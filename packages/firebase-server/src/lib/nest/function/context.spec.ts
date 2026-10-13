import { type } from 'arktype';
import { badRequestError, firebaseServerErrorInfo } from '../../function/error';
import { assertValidParams, FIREBASE_SERVER_VALIDATION_ERROR_CODE, readFirebaseServerValidationErrorSummary } from './context';

const testParamsType = type({ name: 'string' });

describe('assertValidParams()', () => {
  it('should return valid data', () => {
    const result = assertValidParams(testParamsType, { name: 'a' });
    expect(result).toEqual({ name: 'a' });
  });

  it('should throw a validation error on invalid data', () => {
    let error: unknown;

    try {
      assertValidParams(testParamsType, {});
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(firebaseServerErrorInfo(error).serverErrorCode).toBe(FIREBASE_SERVER_VALIDATION_ERROR_CODE);
  });
});

describe('readFirebaseServerValidationErrorSummary()', () => {
  it('should return the per-field summary of a validation error', () => {
    let error: unknown;

    try {
      assertValidParams(testParamsType, {});
    } catch (e) {
      error = e;
    }

    expect(readFirebaseServerValidationErrorSummary(error)).toBe('name must be a string (was missing)');
  });

  it('should return undefined for a bad request error that is not a validation error', () => {
    expect(readFirebaseServerValidationErrorSummary(badRequestError('x'))).toBeUndefined();
  });

  it('should return undefined for a plain error', () => {
    expect(readFirebaseServerValidationErrorSummary(new Error('x'))).toBeUndefined();
  });

  it('should return undefined for undefined', () => {
    expect(readFirebaseServerValidationErrorSummary(undefined)).toBeUndefined();
  });
});
