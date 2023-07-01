import { setIncludes, ReadKeyFunction, setsAreEquivalent } from '@dereekb/util';
import { firstValueFromIterable } from '../iterable';
import { asSet, containsAnyValue, containsAnyValueFromSet, containsNoValueFromSet, containsNoneOfValue, findValuesFrom, hasDifferentValues, setContainsAllValues, setContainsAnyValue } from './set';

describe('asSet()', () => {
  it('should turn a single string value into a set with that string', () => {
    const value = 'test';
    const result = asSet(value);

    expect(result.size).toBe(1);
    expect(firstValueFromIterable(result)).toBe(value);
  });
});

describe('hasDifferentValues()', () => {
  it('should return true if the sets contain different values.', () => {
    const a = [1];
    const b = [1, 2, 3];

    expect(hasDifferentValues(a, b)).toBe(true);
    expect(hasDifferentValues(b, a)).toBe(true);
  });

  it('should return false if both inputs are undefined.', () => {
    const a = undefined;
    const b = undefined;

    expect(hasDifferentValues(a, b)).toBe(true);
    expect(hasDifferentValues(b, a)).toBe(true);
  });

  it('should return false if both inputs are null or undefined.', () => {
    const a = null;
    const b = undefined;

    expect(hasDifferentValues(a, b)).toBe(true);
    expect(hasDifferentValues(b, a)).toBe(true);
  });

  it('should return false if the sets contain the same values.', () => {
    const a = [1, 2];

    expect(hasDifferentValues(a, a)).toBe(false);
  });
});

describe('findValuesFrom()', () => {
  const values = [1, 2, 3, 4, 5];
  const readKey: ReadKeyFunction<number, string> = (x) => String(x);

  describe('exclude=true', () => {
    it('should return all values if both keysToFind and valuesToFind is undefined', () => {
      const results = findValuesFrom({
        values,
        readKey,
        exclude: true
      });

      expect(results.length).toBe(values.length);
    });

    it('should return excluded values found via key', () => {
      const results = findValuesFrom({
        values,
        readKey,
        keysToFind: ['1', '2'],
        exclude: true
      });

      expect(results.length).toBe(3);
      expect(results).not.toContain(1);
      expect(results).not.toContain(2);
      expect(results).toContain(3);
      expect(results).toContain(4);
      expect(results).toContain(5);
    });

    it('should return excluded values found via value', () => {
      const results = findValuesFrom({
        values,
        readKey,
        valuesToFind: [1, 2],
        exclude: true
      });

      expect(results.length).toBe(3);
      expect(results).not.toContain(1);
      expect(results).not.toContain(2);
      expect(results).toContain(3);
      expect(results).toContain(4);
      expect(results).toContain(5);
    });
  });

  it('should return no values if both keysToFind and valuesToFind is undefined', () => {
    const results = findValuesFrom({
      values,
      readKey
    });

    expect(results.length).toBe(0);
  });

  it('should return values found via key', () => {
    const results = findValuesFrom({
      values,
      readKey,
      keysToFind: ['1', '2']
    });

    expect(results.length).toBe(2);
    expect(results).toContain(1);
    expect(results).toContain(2);
  });

  it('should return values found via value', () => {
    const results = findValuesFrom({
      values,
      readKey,
      valuesToFind: [1, 2]
    });

    expect(results.length).toBe(2);
    expect(results).toContain(1);
    expect(results).toContain(2);
  });
});

describe('setIncludes()', () => {
  describe('mode=all', () => {
    it('should return true if the set includes all the values', () => {
      const values = ['a'];
      const set = new Set([...values, 'b', 'c']);
      const result = setIncludes(set, values, 'all');
      expect(result).toBe(true);
    });

    it('should return true if the set includes the value', () => {
      const values = 3;
      const set = new Set([1, 2, values]);
      const result = setIncludes(set, values, 'all');
      expect(result).toBe(true);
    });

    it('should return true if the set includes the string value', () => {
      const values = 'alongname';
      const set = new Set([values, 'b', 'c']);
      const result = setIncludes(set, values, 'all');
      expect(result).toBe(true);
    });
  });
});

describe('containsNoneOfValue()', () => {
  it('should return false if the array contains any value from the set.', () => {
    const value = 'a';
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsNoneOfValue(set, [value])).toBe(false);
  });

  it('should return false if the array contains any value from the set.', () => {
    const value = 1;
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsNoneOfValue(set, value)).toBe(false);
  });

  it('should return false if the array contains any value from the array.', () => {
    const value = 'a';
    const array = [value];

    expect(array.indexOf(value) !== -1);
    expect(containsNoneOfValue(array, [value])).toBe(false);
  });

  it('should return true if the input array is empty.', () => {
    const value = 'a';
    const array = [value];
    expect(containsNoneOfValue(array, [])).toBe(true);
  });

  it('should return true if the array does not contain a value from the array.', () => {
    const value = 'a';
    const array = [value];
    expect(containsNoneOfValue(array, ['b', 'c'])).toBe(true);
  });
});

describe('containsNoValueFromSet()', () => {
  it('should return false if the array contains any value from the set.', () => {
    const value = 'a';
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsNoValueFromSet([value], set)).toBe(false);
  });

  it('should return false if the array contains a value from the set.', () => {
    const value = 1;
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsNoValueFromSet(value, set)).toBe(false);
  });

  it('should return true if the array does not contain a value from the set because it is empty.', () => {
    const value = 'a';
    const set = new Set();
    expect(containsNoValueFromSet([value], set)).toBe(true);
  });

  it('should return true if the array does not contain a value from the set.', () => {
    const value = 'a';
    const set = new Set('b');
    expect(containsNoValueFromSet([value], set)).toBe(true);
  });
});

describe('containsAnyValue()', () => {
  it('should return true if the array contains any value from the set.', () => {
    const value = 'a';
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsAnyValue(set, [value])).toBe(true);
  });

  it('should return true if the array contains any value from the set.', () => {
    const value = 1;
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsAnyValue(set, value)).toBe(true);
  });

  it('should return true if the array contains any value from the array.', () => {
    const value = 'a';
    const array = [value];

    expect(array.indexOf(value) !== -1);
    expect(containsAnyValue(array, [value])).toBe(true);
  });

  it('should return false if the input array is empty.', () => {
    const value = 'a';
    const array = [value];
    expect(containsAnyValue(array, [])).toBe(false);
  });

  it('should return false if the array does not contain a value from the array.', () => {
    const value = 'a';
    const array = [value];
    expect(containsAnyValue(array, ['b', 'c'])).toBe(false);
  });
});

describe('containsAnyValueFromSet()', () => {
  it('should return true if the array contains any value from the set.', () => {
    const value = 'a';
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsAnyValueFromSet([value], set)).toBe(true);
  });

  it('should return true if the array contains a value from the set.', () => {
    const value = 1;
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsAnyValueFromSet(value, set)).toBe(true);
  });

  it('should return false if the array does not contain a value from the set because it is empty.', () => {
    const value = 'a';
    const set = new Set();
    expect(containsAnyValueFromSet([value], set)).toBe(false);
  });

  it('should return false if the array does not contain a value from the set.', () => {
    const value = 'a';
    const set = new Set('b');
    expect(containsAnyValueFromSet([value], set)).toBe(false);
  });
});

describe('setContainsAnyValue()', () => {
  it('should return false if the input array is empty.', () => {
    const array: string[] = [];
    const set = new Set([...array, 'c']);

    const result = setContainsAnyValue(set, array);
    expect(result).toBe(false);
  });

  it('should return true if the input array is empty and emptyValuesToFindArrayResult=true.', () => {
    const array: string[] = [];
    const set = new Set([...array, 'c']);

    const result = setContainsAnyValue(set, array, true);
    expect(result).toBe(true);
  });

  it('should return true if the set contains the value.', () => {
    const value = 'a';
    const set = new Set([value]);

    expect(set.has(value));
    expect(setContainsAnyValue(set, [value])).toBe(true);
  });

  it('should return true if the set contains any of the values', () => {
    const value = 1;
    const set = new Set([value, 2, 3]);

    expect(set.has(value));
    expect(setContainsAnyValue(set, value)).toBe(true);
  });

  it('should return false if the set does not contain the value.', () => {
    const value = 'a';
    const set = new Set();
    expect(setContainsAnyValue(set, [value])).toBe(false);
  });
});

describe('setContainsAllValues', () => {
  it('should return true if the input array is empty.', () => {
    const array: string[] = [];
    const set = new Set([...array, 'c']);

    const result = setContainsAllValues(set, array);
    expect(result).toBe(true);
  });

  it('should return true if the set contains all values from the input array.', () => {
    const array = ['a', 'b'];
    const set = new Set([...array, 'c']);

    const result = setContainsAllValues(set, array);
    expect(result).toBe(true);
  });

  it('should return false if the set does not contain all values from the input array.', () => {
    const array = ['a', 'b'];
    const set = new Set([...array]);

    array.push('c'); // add c

    const result = setContainsAllValues(set, array);
    expect(result).toBe(false);
  });
});

describe('setsAreEquivalent()', () => {
  it('should return true if the sets have the same values.', () => {
    const values = [0, 1, 2];
    const result = setsAreEquivalent(new Set(values), new Set(values));
    expect(result).toBe(true);
  });

  it('should return false if one set is a subset of another set but not the same', () => {
    const values = [0, 1, 2];
    const result = setsAreEquivalent(new Set(values), new Set([0, 1]));
    expect(result).toBe(false);
  });
});
