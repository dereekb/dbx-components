import { TransformStringFunction } from '../string/transform';
import { containsAllStringsAnyCase, containsAnyStringAnyCase, containsStringAnyCase, findUniqueCaseInsensitiveStrings, findUniqueTransform } from './array.string';

describe('findUniqueCaseInsensitiveStrings()', () => {
  it('should return only the strings that are unique from the array.', () => {
    const uniqueValues = ['a', 'b'];
    const values = [...uniqueValues, ...uniqueValues.map((x) => x.toUpperCase())];

    const result = findUniqueCaseInsensitiveStrings(values, (x) => x);

    expect(result.length).toBe(uniqueValues.length);
  });
});

describe('containsStringAnyCase()', () => {
  it('should return true if the array contains the string.', () => {
    const value = 'a';
    const values = [value];

    const result = containsStringAnyCase(values, value);
    expect(result).toBe(true);
  });

  it('should return true if the array contains the string in any case.', () => {
    const value = 'a';
    const values = [value.toUpperCase()];

    const result = containsStringAnyCase(values, value);
    expect(result).toBe(true);
  });

  it('should return false if the array does not contain the value because it is empty.', () => {
    const value = 'a';
    const values: string[] = [];

    const result = containsStringAnyCase(values, value);
    expect(result).toBe(false);
  });

  it('should return false if the array does not contain the value.', () => {
    const value = 'a';
    const values: string[] = ['b'];

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

  it('should return false if the array does not contain any of the input values because it is empty.', () => {
    const value = 'a';
    const valuesSet: string[] = [];

    const result = containsAnyStringAnyCase(valuesSet, [value]);
    expect(result).toBe(false);
  });

  it('should return false if the array does not contain any of the input values.', () => {
    const value = 'a';
    const valuesSet: string[] = ['b'];

    const result = containsAnyStringAnyCase(valuesSet, [value]);
    expect(result).toBe(false);
  });

  it('should return true if the comparison array is empty.', () => {
    const values: string[] = ['b'];
    const result = containsAnyStringAnyCase(values, []);
    expect(result).toBe(true);
  });

  it('should return false if the comparison array is empty and mustContainAtleastOneItem is true.', () => {
    const value = 'a';
    const values: string[] = ['b'];
    const mustContainAtleastOneItem = true;

    const result = containsAnyStringAnyCase(values, [], mustContainAtleastOneItem);
    expect(result).toBe(false);
  });
});

describe('containsAllStringsAnyCase()', () => {
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

describe('findUniqueTransform()', () => {
  describe('caseInsensitive=true', () => {
    const transform = findUniqueTransform({
      caseInsensitive: true
    });

    it('should return only unique strings', () => {
      const values = ['tesT', 'test', 'TEST', 'TesT'];
      const result = transform(values);
      expect(result.length).toBe(1);
      expect(result[0]).toBe(values[0]);
    });
  });

  describe('transform', () => {
    describe('caseInsensitive=true', () => {
      const transformFn: TransformStringFunction = (x) => `__${x}__`;

      const transform = findUniqueTransform({
        transform: transformFn,
        caseInsensitive: true
      });

      it('should return only unique strings', () => {
        const values = ['tesT', 'test', 'TEST', 'TesT'];
        const result = transform(values);
        expect(result.length).toBe(1);
        expect(result[0]).toBe(transformFn(values[0]));
      });
    });

    describe('caseInsensitive=false', () => {
      const transformFn: TransformStringFunction = (x) => `NEW_${x}`;

      const transform = findUniqueTransform({
        transform: transformFn,
        caseInsensitive: false
      });

      it('should return only unique strings', () => {
        const values = ['tesT', 'test', 'TEST', 'TesT'];
        const result = transform([...values, ...values]);
        expect(result.length).toBe(values.length);
        expect(result[0]).toBe(transformFn(values[0]));
      });
    });
  });

  describe('with toLowercase=true', () => {
    const transform = findUniqueTransform({
      toLowercase: true
    });

    it('should return only unique strings', () => {
      const result = transform(['test', 'TEST', 'tesT', 'TesT']);
      expect(result.length).toBe(1);
      expect(result[0]).toBe('test');
    });
  });

  describe('with toUppercase=true', () => {
    const transform = findUniqueTransform({
      toUppercase: true
    });

    it('should return only unique strings', () => {
      const result = transform(['test', 'TEST', 'tesT', 'TesT']);
      expect(result.length).toBe(1);
      expect(result[0]).toBe('TEST');
    });
  });
});
