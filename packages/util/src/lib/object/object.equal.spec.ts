import { areEqualObjectValues } from ".";

describe('areEqualObjectValues', () => {

  it('should return true if both objects are equal.', () => {
    const a = { a: 'a' };
    const b = { a: 'a' };

    expect(areEqualObjectValues(a, b)).toBe(true);
  });

  it('should return false if both objects have the same properties but are not equal.', () => {
    const a = { a: 'a' };
    const b = { a: 'b' };

    expect(areEqualObjectValues(a as any, b as any)).toBe(false);
  });

  it('should return false if both objects are not equal.', () => {
    const a = { a: 'a' };
    const b = { b: 'a' };

    expect(areEqualObjectValues(a as any, b as any)).toBe(false);
  });

});
