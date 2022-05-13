import { makeArray } from '../array';
import { isIterable, useIterableOrValue } from './iterable';

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

});

describe('useIterableOrValue()', () => {

  it('should have used the values from an array', () => {
    const expectedValue = 3;
    const array = makeArray({ count: expectedValue, make: () => 1 });
    let total = 0;

    useIterableOrValue(array, (x) => total += x);

    expect(total).toBe(expectedValue);
  });

  it('should have used a non-null value', () => {
    let used = false;
    useIterableOrValue(1, () => used = true);
    expect(used).toBe(true);
  });

  it('should not have used a null value', () => {
    let used = false;
    useIterableOrValue(null, () => used = true);
    expect(used).toBe(false);
  });

  it('should not have used an empty array', () => {
    let used = false;
    useIterableOrValue([], () => used = true);
    expect(used).toBe(false);
  });

});
