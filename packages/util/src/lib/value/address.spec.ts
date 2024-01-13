import { isCompleteUnitedStatesAddress, isUsStateCodeString, type UnitedStatesAddress } from './address';

describe('isCompleteUnitedStatesAddress()', () => {
  it('should return true for a complete address.', () => {
    const address: UnitedStatesAddress = {
      line1: 'hello world',
      city: 'San Antonio',
      state: 'TX',
      zip: '78216'
    };

    const result = isCompleteUnitedStatesAddress(address);
    expect(result).toBe(true);
  });

  it('should return false for an incomplete address.', () => {
    const address: UnitedStatesAddress = {
      line1: '',
      city: 'San Antonio',
      state: 'TX',
      zip: '78216'
    };

    const result = isCompleteUnitedStatesAddress(address);
    expect(result).toBe(false);
  });
});

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
