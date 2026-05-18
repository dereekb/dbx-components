import { makeWithFactory } from '../getter';
import { existsInIterable, findInIterable, firstValueFromIterable, isEmptyIterable, isIterable, useIterableOrValue, wrapTuples } from './iterable';

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

  it('should return false for null.', () => {
    expect(isIterable(null)).toBe(false);
  });

  it('should return false for undefined.', () => {
    expect(isIterable(undefined)).toBe(false);
  });

  it('should return false for 0.', () => {
    expect(isIterable(0)).toBe(false);
  });

  it('should return true for a custom iterable with Symbol.iterator.', () => {
    const customIterable = {
      [Symbol.iterator]() {
        let i = 0;
        return {
          next() {
            return i < 3 ? { value: i++, done: false } : { value: undefined, done: true };
          }
        };
      }
    };
    expect(isIterable(customIterable)).toBe(true);
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

describe('firstValueFromIterable()', () => {
  it('should return undefined for an empty iterable', () => {
    expect(firstValueFromIterable([])).toBeUndefined();
    expect(firstValueFromIterable(new Set())).toBeUndefined();
  });

  it('should return the first value of a non-empty array', () => {
    expect(firstValueFromIterable([1, 2, 3])).toBe(1);
  });

  it('should return the first value of a non-empty Set', () => {
    expect(firstValueFromIterable(new Set(['a', 'b']))).toBe('a');
  });
});

describe('findInIterable()', () => {
  it('should return the first matching value', () => {
    const result = findInIterable([1, 2, 3, 4], (x) => x > 2);
    expect(result).toBe(3);
  });

  it('should return undefined when no value matches', () => {
    const result = findInIterable([1, 2, 3], () => false);
    expect(result).toBeUndefined();
  });

  it('should return undefined for an empty iterable', () => {
    const result = findInIterable([], () => true);
    expect(result).toBeUndefined();
  });

  it('should work with Sets', () => {
    const result = findInIterable(new Set([1, 2, 3]), (x) => x === 2);
    expect(result).toBe(2);
  });
});

describe('existsInIterable()', () => {
  it('should return true when at least one value matches', () => {
    expect(existsInIterable([1, 2, 3], (x) => x === 2)).toBe(true);
  });

  it('should return false when no value matches', () => {
    expect(existsInIterable([1, 2, 3], (x) => x === 99)).toBe(false);
  });

  it('should return false for an empty iterable', () => {
    expect(existsInIterable([], () => true)).toBe(false);
  });

  it('should short-circuit on the first match', () => {
    let count = 0;
    const result = existsInIterable([1, 2, 3, 4], (x) => {
      count += 1;
      return x === 2;
    });
    expect(result).toBe(true);
    expect(count).toBe(2);
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
