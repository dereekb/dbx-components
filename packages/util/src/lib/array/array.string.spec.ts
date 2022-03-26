import { containsAllStringsAnyCase, containsAnyStringAnyCase, containsStringAnyCase, findUniqueCaseInsensitiveStrings } from "./array.string";

describe('findUniqueCaseInsensitiveStrings', () => {

  it('should return only the strings that are unique from the array.', () => {
    const uniqueValues = ['a', 'b'];
    const values = [...uniqueValues, ...uniqueValues.map(x => x.toUpperCase())];

    const result = findUniqueCaseInsensitiveStrings(values, (x) => x);

    expect(result.length).toBe(uniqueValues.length);
  });

});

describe('containsStringAnyCase', () => {

  it('should return true if the array contains the string in any case.', () => {
    const value = 'a';
    const values = [value.toUpperCase()];

    const result = containsStringAnyCase(values, value);
    expect(result).toBe(true);
  });

  it('should return false if the array does not contain the value.', () => {
    const value = 'a';
    const values: string[] = [];

    const result = containsStringAnyCase(values, value);
    expect(result).toBe(false);
  });

});

describe('containsAnyStringAnyCase', () => {

  it('should return true if the array contains any of the input strings in any case.', () => {
    const value = 'a';
    const values = [value.toUpperCase()];

    const result = containsAnyStringAnyCase(values, [value]);
    expect(result).toBe(true);
  });

  it('should return false if the array does not contain any of the input values.', () => {
    const value = 'a';
    const values: string[] = [];

    const result = containsAnyStringAnyCase(values, [value]);
    expect(result).toBe(false);
  });

});

describe('containsAllStringsAnyCase', () => {

  it('should return true if the array contains all of the input strings in any case.', () => {
    const value = 'a';
    const values = [value.toUpperCase()];

    const result = containsAllStringsAnyCase(values, [value]);
    expect(result).toBe(true);
  });

  it('should return false if the array does not contain all of the input values.', () => {
    const value = 'a';
    const values: string[] = [];

    const result = containsAllStringsAnyCase(values, [value]);
    expect(result).toBe(false);
  });

});
