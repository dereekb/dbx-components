import { containsAnyValue, containsAnyValueFromSet, setContainsAllValues, setContainsAnyValue } from "./set";

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

describe('setContainsAllValues', () => {

  it('should return true if the set contains all values from the input array.', () => {
    const array = ['a', 'b'];
    const set = new Set([...array, 'c']);

    const result = setContainsAllValues(set, array);
    expect(result).toBe(true);
  });

  it('should return false if the set does not contain all values from the input array.', () => {
    const array = ['a', 'b'];
    const set = new Set([...array]);

    array.push('c');

    const result = setContainsAllValues(set, array);
    expect(result).toBe(false);
  });

});
