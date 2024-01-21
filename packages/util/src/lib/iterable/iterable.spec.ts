import { makeWithFactory } from '../getter';
import { isEmptyIterable, isIterable, useIterableOrValue, wrapTuples } from './iterable';

describe('isIterable()', () => {
  it('should return true for an array.', () => {
    expect(isIterable([])).toBe(true);
  });

  it('should return true for a set.', () => {
    expect(isIterable(new Set())).toBe(true);
  });

  it('should return true for a map.', () => {
    expect(isIterable(new Map())).toBe(true);
  });

  it('should return false for a string.', () => {
    expect(isIterable('test')).toBe(false);
  });

  it('should return true for a non-empty string if treatStringAsIterable=true', () => {
    expect(isIterable('test', true)).toBe(true);
  });

  it('should return false for a number.', () => {
    expect(isIterable('test')).toBe(false);
  });
});

describe('isEmptyIterable()', () => {
  it('should return true for empty arrays.', () => {
    expect(isEmptyIterable([])).toBe(true);
  });

  it('should return false for non-empty arrays.', () => {
    expect(isEmptyIterable(['test'])).toBe(false);
  });

  it('should return true for empty sets.', () => {
    expect(isEmptyIterable(new Set())).toBe(true);
  });

  it('should return true for non-empty sets.', () => {
    expect(isEmptyIterable(new Set('test'))).toBe(false);
  });

  it('should return true for empty strings.', () => {
    expect(isEmptyIterable('')).toBe(true);
  });

  it('should return false for non-empty strings.', () => {
    expect(isEmptyIterable('non-empty')).toBe(false);
  });

  it('should return true for empty maps.', () => {
    expect(isEmptyIterable(new Map())).toBe(true);
  });

  it('should return false for non-empty maps.', () => {
    expect(isEmptyIterable(new Map([['a', 'a']]))).toBe(false);
  });
});

describe('useIterableOrValue()', () => {
  it('should have used the values from an array', () => {
    const expectedValue = 3;
    const array = makeWithFactory(() => 1, expectedValue);
    let total = 0;

    useIterableOrValue(array, (x) => (total += x));

    expect(total).toBe(expectedValue);
  });

  it('should have used a non-null value', () => {
    let used = false;
    useIterableOrValue(1, () => (used = true));
    expect(used).toBe(true);
  });

  it('should not have used a null value', () => {
    let used = false;
    useIterableOrValue(null, () => (used = true));
    expect(used).toBe(false);
  });

  it('should not have used an empty array', () => {
    let used = false;
    useIterableOrValue([], () => (used = true));
    expect(used).toBe(false);
  });

  it('should use a string as a value', () => {
    let count = 0;
    useIterableOrValue('test', () => (count += 1));
    expect(count).toBe(1);
  });

  it('should use a string as an iterable if useStringAsIterable=true', () => {
    let count = 0;
    const value = 'test';
    useIterableOrValue(value, () => (count += 1), true);
    expect(count).toBe(value.length);
  });
});

describe('wrapTuples()', () => {
  it('should wrap the tuple value to an array.', () => {
    const tuple = ['true', 'false'];

    const result = wrapTuples(tuple);
    expect(result[0]).toBe(tuple);
  });

  it('should return the array of tuples.', () => {
    const tuple = [['true', 'false']];

    const result = wrapTuples(tuple);
    expect(result[0]).toBe(tuple[0]);
  });

  describe('tuples with array as first value.', () => {
    it('should return the tuple if all of its values imply that it is an array of tuples.', () => {
      const tuple = [
        [1, 2, 3],
        [1, 2, 3],
        [1, 2, 3]
      ];

      const result = wrapTuples(tuple);
      expect(result[0]).toBe(tuple[0]);
    });

    it('should return the tuple if it is wrapped within an array', () => {
      const tuple = [
        [1, 2, 3],
        [1, 2, 3],
        [1, 2, 3]
      ];

      const result = wrapTuples([tuple]);
      expect(result[0]).toBe(tuple);
    });

    it('should wrap the tuple value to an array.', () => {
      const tuple = [[1, 2, 3], 'true', 'false'];

      const result = wrapTuples(tuple);
      expect(result[0]).toBe(tuple);
    });

    it('should return the array of tuples.', () => {
      const tupleA = [[1, 2, 3], 'true', 'false'];
      const tupleB = [[1, 2, 5], 'false', 'false'];
      const input = [tupleA, tupleB];

      const result = wrapTuples(input);
      expect(result[0]).toBe(tupleA);
      expect(result[1]).toBe(tupleB);
    });
  });
});
