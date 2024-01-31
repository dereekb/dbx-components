import { isMapIdentityFunction } from '../value';
import { passThrough } from './function';

describe('passThrough()', () => {
  it('should return true when passed to isMapIdentityFunction()', () => {
    expect(isMapIdentityFunction(passThrough)).toBe(true);
  });
});
