import { isUsStateCodeString } from './address';

describe('isUsStateCodeString()', () => {
  it('should return true for upper case state codes.', () => {
    const result = isUsStateCodeString('TX');
    expect(result).toBe(true);
  });
  it('should return false for invalid state codes.', () => {
    const result = isUsStateCodeString('XX');
    expect(result).toBe(false);
  });
  it('should return false for lower case state codes.', () => {
    const result = isUsStateCodeString('tx');
    expect(result).toBe(false);
  });
});
