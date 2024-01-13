import { mergeArraysIntoArray, range, flattenArray, type Maybe } from '@dereekb/util';
import { takeLast } from './array';

describe('flattenArray', () => {
  it('should return all non-null/undefined values from first dimension, and all values from the second dimension.', () => {
    const expected = [1, 2, null];
    const array: Maybe<(number | null)[]>[] = [[expected[0]], null, undefined, [expected[1], null]];

    const result = flattenArray(array);
    expect(result.length).toBe(expected.length);
    expect(result[0]).toBe(expected[0]);
    expect(result[1]).toBe(expected[1]);
    expect(result[2]).toBe(expected[2]);
  });
});

describe('takeLast', () => {
  const testArray = [1, 2, 3];
  const testLongerArray = [1, 2, 3, 4, 5];

  it('should take the last elements', () => {
    const result = takeLast(testArray, 2);
    expect(result.length).toBe(2);
    expect(result).toContain(2);
    expect(result).toContain(3);
    expect(result[0]).toBe(2);
    expect(result[1]).toBe(3);
  });

  it('should take the last elements and keep the specified number of elements in the front', () => {
    const result = takeLast(testArray, 2, 1); // Take 2 total, keep 1 from front
    expect(result.length).toBe(2);
    expect(result).toContain(1);
    expect(result).toContain(3);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(3);
  });

  describe('longer take', () => {
    it('should take the last elements', () => {
      const result = takeLast(testArray, 5, 1);
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result).toContain(3);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(3);
    });
  });

  describe('longer array', () => {
    it('should take the last elements and keep the specified number of elements in the front', () => {
      const result = takeLast(testLongerArray, 3, 1); // Take 3 total, keep 1 from front
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(4);
      expect(result).toContain(5);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(4);
      expect(result[2]).toBe(5);
    });

    it('should take the last elements and keep the specified number of elements in the front more', () => {
      const result = takeLast(testLongerArray, 3, 2); // Take 3 total, keep 2 from front
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result).toContain(5);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(5);
    });
  });
});

describe('mergeArraysIntoArray()', () => {
  it('should add the values from the second array into the target array in the same order.', () => {
    const initial = [0];
    const second = range({ start: 1, end: 5 });

    const target = [...initial];
    const result = mergeArraysIntoArray(target, second);

    expect(result.length).toBe(initial.length + second.length);
    expect(result[0]).toBe(initial[0]);

    for (let i = 0; i < second.length; i += 1) {
      expect(result[i + 1]).toBe(second[i]);
    }
  });

  it('should add the values from the second and third array into the target array in the same order.', () => {
    const initial = [0];
    const second = range({ start: 1, end: 5 });

    const target = [...initial];
    const result = mergeArraysIntoArray(target, second, second); // second twice

    expect(result.length).toBe(initial.length + second.length * 2);
    expect(result[0]).toBe(initial[0]);

    for (let i = 0; i < second.length; i += 1) {
      expect(result[i + 1]).toBe(second[i]);
    }

    for (let i = 0; i < second.length; i += 1) {
      expect(result[i + 1 + second.length]).toBe(second[i]);
    }
  });
});
