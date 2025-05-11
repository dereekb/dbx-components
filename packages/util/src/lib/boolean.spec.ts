import { reduceBooleansWithAnd, reduceBooleansWithOr, reduceBooleansWithAndFn, reduceBooleansWithOrFn, booleanFactory, randomBoolean, type BooleanFactory } from './boolean';

describe('reduceBooleansWithAnd', () => {
  it('should return true if all values are true', () => {
    expect(reduceBooleansWithAnd([true, true, true])).toBe(true);
  });
  it('should return false if any value is false', () => {
    expect(reduceBooleansWithAnd([true, false, true])).toBe(false);
  });
  it('should use emptyArrayValue if array is empty and value is provided', () => {
    expect(reduceBooleansWithAnd([], true)).toBe(true);
    expect(reduceBooleansWithAnd([], false)).toBe(false);
  });
  it('should throw TypeError if array is empty and emptyArrayValue is not provided', () => {
    expect(() => reduceBooleansWithAnd([])).toThrow(TypeError);
  });
});

describe('reduceBooleansWithAndFn', () => {
  const reduceAnd = reduceBooleansWithAndFn();
  const reduceAndEmptyTrue = reduceBooleansWithAndFn(true);

  it('should return true if all values are true', () => {
    expect(reduceAnd([true, true, true])).toBe(true);
  });
  it('should return false if any value is false', () => {
    expect(reduceAnd([true, false, true])).toBe(false);
  });
  it('should use emptyArrayValue if array is empty and value is provided at creation', () => {
    expect(reduceAndEmptyTrue([])).toBe(true);
  });
  it('should throw TypeError if array is empty and emptyArrayValue is not provided at creation', () => {
    expect(() => reduceAnd([])).toThrow(TypeError);
  });
});

describe('reduceBooleansWithOr', () => {
  it('should return true if any value is true', () => {
    expect(reduceBooleansWithOr([false, true, false])).toBe(true);
  });
  it('should return false if all values are false', () => {
    expect(reduceBooleansWithOr([false, false, false])).toBe(false);
  });
  it('should use emptyArrayValue if array is empty and value is provided', () => {
    expect(reduceBooleansWithOr([], true)).toBe(true);
    expect(reduceBooleansWithOr([], false)).toBe(false);
  });
  it('should throw TypeError if array is empty and emptyArrayValue is not provided', () => {
    expect(() => reduceBooleansWithOr([])).toThrow(TypeError);
  });
});

describe('reduceBooleansWithOrFn', () => {
  const reduceOr = reduceBooleansWithOrFn();
  const reduceOrEmptyFalse = reduceBooleansWithOrFn(false);

  it('should return true if any value is true', () => {
    expect(reduceOr([false, true, false])).toBe(true);
  });
  it('should return false if all values are false', () => {
    expect(reduceOr([false, false, false])).toBe(false);
  });
  it('should use emptyArrayValue if array is empty and value is provided at creation', () => {
    expect(reduceOrEmptyFalse([])).toBe(false);
  });
  it('should throw TypeError if array is empty and emptyArrayValue is not provided at creation', () => {
    expect(() => reduceOr([])).toThrow(TypeError);
  });
});

describe('booleanFactory', () => {
  it('should create a factory that returns true if chance is 100', () => {
    const factory = booleanFactory({ chance: 100 });
    expect(factory()).toBe(true);
    expect(factory()).toBe(true);
  });

  it('should create a factory that returns false if chance is 0', () => {
    const factory = booleanFactory({ chance: 0 });
    expect(factory()).toBe(false);
    expect(factory()).toBe(false);
  });

  it('should create a factory that can return true and false if chance is 50', () => {
    const factory: BooleanFactory = booleanFactory({ chance: 50 });
    const results = new Set<boolean>();
    for (let i = 0; i < 100; i++) {
      results.add(factory());
    }
    // Probabilistic: Over 100 runs, we expect both true and false to appear for a 50% chance.
    expect(results.has(true)).toBe(true);
    expect(results.has(false)).toBe(true);
    expect(results.size).toBe(2); // Ensure it's not stuck on one value
  });
});

describe('randomBoolean', () => {
  it('should return true if chance is 100', () => {
    expect(randomBoolean(100)).toBe(true);
  });

  it('should return false if chance is 0', () => {
    expect(randomBoolean(0)).toBe(false);
  });

  it('should return a boolean if chance is 50 (default)', () => {
    const results = new Set<boolean>();
    for (let i = 0; i < 100; i++) {
      results.add(randomBoolean()); // Default chance is 50
    }
    expect(results.has(true)).toBe(true);
    expect(results.has(false)).toBe(true);
    expect(results.size).toBe(2);
  });

  it('should handle chances between 0 and 100', () => {
    const results25 = new Set<boolean>();
    for (let i = 0; i < 200; i++) {
      // More iterations for lower/higher chances
      results25.add(randomBoolean(25));
    }
    expect(results25.has(true)).toBe(true);
    expect(results25.has(false)).toBe(true);

    const results75 = new Set<boolean>();
    for (let i = 0; i < 200; i++) {
      results75.add(randomBoolean(75));
    }
    expect(results75.has(true)).toBe(true);
    expect(results75.has(false)).toBe(true);
  });
});
