import { allObjectsAreEqual, areEqualContext, isEqualContext } from "./equal";

describe('isEqualContext', () => {

  const isEqual = (a: number, b: number) => a === b;

  it('should create a function.', () => {
    const result = isEqualContext(0, isEqual);

    expect(typeof result).toBe('function');
  });

  describe('function', () => {

    it('should return true for matching values.', () => {
      const value = 0;

      const context = isEqualContext(value, isEqual);
      const result = context(value);

      expect(result).toBe(true);
    });

    it('should return false for non-matching values.', () => {
      const value: number = 0;

      const context = isEqualContext(value, isEqual);
      const result = context(value + 10);

      expect(result).toBe(false);
    });

  });

});

describe('areEqualContext', () => {

  const isEqual = (a: number, b: number) => a === b;

  it('should create a function.', () => {
    const result = areEqualContext(0, isEqual);

    expect(typeof result).toBe('function');
  });

  describe('function', () => {

    it('should return true for matching values.', () => {
      const value = 0;

      const context = areEqualContext(value, isEqual);
      const result = context([value, value, value]);

      expect(result).toBe(true);
    });

    it('should return false for non-matching values.', () => {
      const value: number = 0;

      const context = areEqualContext(value, isEqual);
      const result = context([value, value + 1, value + 2]);

      expect(result).toBe(false);
    });

  });

});

describe('allObjectsAreEqual()', () => {

  it('should return true 0 objects are entered.', () => {
    const isEqual = (a: any, b: any) => a === b;
    const objects: any[] = [];

    const result = allObjectsAreEqual(objects, isEqual);

    expect(result).toBe(true);
  });

  it('should return true only 1 object is entered.', () => {
    const isEqual = (a: any, b: any) => a === b;
    const objects = [1];

    const result = allObjectsAreEqual(objects, isEqual);

    expect(result).toBe(true);
  });

  it('should return true if all objects are equal.', () => {
    const isEqual = (a: any, b: any) => a === b;
    const objects = [undefined, undefined, undefined];

    const result = allObjectsAreEqual(objects, isEqual);

    expect(result).toBe(true);
  });

  it('should return false if not all objects are equal.', () => {
    const isEqual = (a: any, b: any) => a === b;
    const objects = [undefined, 'test', undefined];

    const result = allObjectsAreEqual(objects, isEqual);

    expect(result).toBe(false);
  });

});
