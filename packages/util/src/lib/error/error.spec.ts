import { isDefaultReadableError, DEFAULT_READABLE_ERROR_CODE } from './error';

describe('isDefaultReadableError()', () => {
  it('should return true for null/undefined', () => {
    expect(isDefaultReadableError(null)).toBe(true);
    expect(isDefaultReadableError(undefined)).toBe(true);
  });

  it('should return true for an empty string', () => {
    expect(isDefaultReadableError('')).toBe(true);
  });

  it('should return true for the default string', () => {
    expect(isDefaultReadableError(DEFAULT_READABLE_ERROR_CODE)).toBe(true);
  });

  it('should return true for an error without a code', () => {
    expect(isDefaultReadableError({ message: 'Error without a code. ' })).toBe(true);
  });

  it('should return true for an error that is the default', () => {
    expect(isDefaultReadableError({ code: DEFAULT_READABLE_ERROR_CODE })).toBe(true);
  });

  it('should return false for a non-empty string that is not the default', () => {
    expect(isDefaultReadableError('NOT_THE_DEFAULT')).toBe(false);
  });

  it('should return false for a non-empty readable error that is not the default', () => {
    expect(isDefaultReadableError({ code: 'NOT_THE_DEFAULT' })).toBe(false);
  });
});
