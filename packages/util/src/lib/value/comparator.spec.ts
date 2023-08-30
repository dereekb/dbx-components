import { safeCompareEquality } from '@dereekb/util';

describe('safeCompareEquality()', () => {
  it('should compare the values if they are both non-null', () => {
    let compared = false;

    const result = safeCompareEquality(0, 1, () => {
      compared = true;
      return false;
    });

    expect(compared).toBe(true);
    expect(result).toBe(false);
  });

  it('should not compare the values if they are both null', () => {
    let compared = false;

    const result = safeCompareEquality(null, null, () => {
      compared = true;
      return false;
    });

    expect(compared).toBe(false);
    expect(result).toBe(true);
  });

  it('should not compare the values if they are both null or undefined', () => {
    let compared = false;

    const result = safeCompareEquality(null, undefined, () => {
      compared = true;
      return false;
    });

    expect(compared).toBe(false);
    expect(result).toBe(false); // undefined is not equal to null
  });
});
