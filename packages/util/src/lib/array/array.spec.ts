import { mergeIntoArray, range } from '@dereekb/util';
import { containsAnyValue, containsAnyValueFromSet, setContainsAnyValue } from '..';
import { takeLast } from './array';

describe('takeLast', () => {

  const testArray = [1, 2, 3];
  const testLongerArray = [1, 2, 3, 4, 5];

  it('should take the last elements', () => {
    const result = takeLast(testArray, 2);
    expect(result.length).toBe(2);
    expect(result).toContain(2);
    expect(result).toContain(3);
    expect(result[0]).toBe(2)
    expect(result[1]).toBe(3);
  });

  it('should take the last elements and keep the specified number of elements in the front', () => {
    const result = takeLast(testArray, 2, 1);  // Take 2 total, keep 1 from front
    expect(result.length).toBe(2);
    expect(result).toContain(1);
    expect(result).toContain(3);
    expect(result[0]).toBe(1)
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
      const result = takeLast(testLongerArray, 3, 1);  // Take 3 total, keep 1 from front
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(4);
      expect(result).toContain(5);
      expect(result[0]).toBe(1)
      expect(result[1]).toBe(4);
      expect(result[2]).toBe(5);
    });

    it('should take the last elements and keep the specified number of elements in the front more', () => {
      const result = takeLast(testLongerArray, 3, 2);  // Take 3 total, keep 2 from front
      expect(result.length).toBe(3);
      expect(result).toContain(1);
      expect(result).toContain(2);
      expect(result).toContain(5);
      expect(result[0]).toBe(1)
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(5);
    });

  });

});


describe('mergeIntoArray', () => {

  it('should add the values from the second array into the target array in the same order.', () => {

    const initial = [0];
    const second = range({ start: 1, end: 5 });

    const target = [...initial];
    const result = mergeIntoArray(target, second);

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
    const result = mergeIntoArray(target, second, second);  // second twice

    expect(result.length).toBe(initial.length + (second.length * 2));
    expect(result[0]).toBe(initial[0]);

    for (let i = 0; i < second.length; i += 1) {
      expect(result[i + 1]).toBe(second[i]);
    }

    for (let i = 0; i < second.length; i += 1) {
      expect(result[i + 1 + second.length]).toBe(second[i]);
    }
  });

});

describe('containsAnyValue', () => {

  it('should return true if the array contains any value from the set.', () => {
    const value = 'a';
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsAnyValue(set, [value])).toBe(true);
  });

  it('should return true if the array contains any value from the array.', () => {
    const value = 'a';
    const array = [value];

    expect(array.indexOf(value) !== -1);
    expect(containsAnyValue(array, [value])).toBe(true);
  });

  it('should return false if the array does not contain a value from the array.', () => {
    const value = 'a';
    const array = [value];
    expect(containsAnyValue(array, [])).toBe(false);
  });

});

describe('containsAnyValueFromSet', () => {

  it('should return true if the array contains any value from the set.', () => {
    const value = 'a';
    const set = new Set([value]);

    expect(set.has(value));
    expect(containsAnyValueFromSet([value], set)).toBe(true);
  });

  it('should return false if the array does not contain a value from the set.', () => {
    const value = 'a';
    const set = new Set();
    expect(containsAnyValueFromSet([value], set)).toBe(false);
  });

});

describe('setContainsAnyValue', () => {

  it('should return true if the set contains the value.', () => {
    const value = 'a';
    const set = new Set([value]);

    expect(set.has(value));
    expect(setContainsAnyValue(set, [value])).toBe(true);
  });

  it('should return false if the set does not contain the value.', () => {
    const value = 'a';
    const set = new Set();
    expect(setContainsAnyValue(set, [value])).toBe(false);
  });

});
