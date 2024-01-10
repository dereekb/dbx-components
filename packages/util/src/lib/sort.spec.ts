import { isMapIdentityFunction, minAndMaxFunction, sortNumbersAscendingFunction, sortValues, sortValuesFunctionOrMapIdentityWithSortRef } from '@dereekb/util';

describe('sortValues()', () => {
  it('should sort the values if sortWith is defined.', () => {
    const values = [2, 1, 0];
    const result = sortValues({ values, sortWith: sortNumbersAscendingFunction });
    expect(result).toBe(values);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(1);
    expect(result[2]).toBe(2);
  });

  describe('sortOnCopy=false/undefined', () => {
    it('should sort the original values.', () => {
      const values = [2, 1, 0];
      const result = sortValues({ values, sortWith: sortNumbersAscendingFunction });
      expect(result).toBe(values);
      expect(result[0]).toBe(0);
    });
  });

  describe('sortOnCopy=true', () => {
    it('should return the input if sortWith is nullish', () => {
      const values = [0, 1, 2];
      const result = sortValues({ values, sortOnCopy: true, sortWith: undefined });
      expect(result).toBe(values);
    });

    it('should return a copy of the input if sortWith is defined.', () => {
      const values = [0, 1, 2];
      const result = sortValues({ values, sortOnCopy: true, sortWith: sortNumbersAscendingFunction });
      expect(result).not.toBe(values);
    });
  });

  describe('alwaysReturnCopy=true', () => {
    it('should return a copy of the input if sortWith is nullish', () => {
      const values = [0, 1, 2];
      const result = sortValues({ values, alwaysReturnCopy: true, sortWith: undefined });
      expect(result).not.toBe(values);
    });

    it('should return a copy of the input if sortWith is defined.', () => {
      const values = [0, 1, 2];
      const result = sortValues({ values, alwaysReturnCopy: true, sortWith: sortNumbersAscendingFunction });
      expect(result).not.toBe(values);
    });
  });
});

describe('sortValuesFunctionOrMapIdentityWithSortRef()', () => {
  it('should return the mapIdentity function if the sortRef is undefined.', () => {
    const result = sortValuesFunctionOrMapIdentityWithSortRef(undefined);
    expect(isMapIdentityFunction(result));
  });

  it('should return the mapIdentity function if the ref is defined but has no sortWith function.', () => {
    const result = sortValuesFunctionOrMapIdentityWithSortRef({ sortWith: undefined });
    expect(isMapIdentityFunction(result));
  });
});

describe('minAndMaxFunction()', () => {
  describe('function', () => {
    const fn = minAndMaxFunction<number>((a, b) => a - b);

    it('should return undefined if no values are passed to the function.', () => {
      const result = fn([]);
      expect(result).toBe(null);
    });

    it('should return the min and max values', () => {
      const min = 0;
      const max = 5;
      const result = fn([min, 1, 2, 3, 4, max]);
      expect(result?.min).toBe(min);
      expect(result?.max).toBe(max);
    });
  });
});
