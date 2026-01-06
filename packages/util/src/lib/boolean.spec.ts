import { invertMaybeBoolean, reduceBooleansWithAnd, reduceBooleansWithOr, reduceBooleansWithAndFn, reduceBooleansWithOrFn, booleanFactory, randomBoolean, stringToBoolean, type BooleanFactory } from './boolean';

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

describe('invertMaybeBoolean', () => {
  it('should return false if the input is true', () => {
    expect(invertMaybeBoolean(true)).toBe(false);
  });

  it('should return true if the input is false', () => {
    expect(invertMaybeBoolean(false)).toBe(true);
  });

  it('should return null if the input is null', () => {
    expect(invertMaybeBoolean(null)).toBe(null);
  });

  it('should return undefined if the input is undefined', () => {
    expect(invertMaybeBoolean(undefined)).toBe(undefined);
  });
});

describe('stringToBoolean()', () => {
  describe('truthy values', () => {
    it('should return true for "true"', () => {
      expect(stringToBoolean('true')).toBe(true);
    });

    it('should return true for "True" (case-insensitive)', () => {
      expect(stringToBoolean('True')).toBe(true);
    });

    it('should return true for "TRUE" (case-insensitive)', () => {
      expect(stringToBoolean('TRUE')).toBe(true);
    });

    it('should return true for "t"', () => {
      expect(stringToBoolean('t')).toBe(true);
    });

    it('should return true for "T" (case-insensitive)', () => {
      expect(stringToBoolean('T')).toBe(true);
    });

    it('should return true for "yes"', () => {
      expect(stringToBoolean('yes')).toBe(true);
    });

    it('should return true for "YES" (case-insensitive)', () => {
      expect(stringToBoolean('YES')).toBe(true);
    });

    it('should return true for "y"', () => {
      expect(stringToBoolean('y')).toBe(true);
    });

    it('should return true for "Y" (case-insensitive)', () => {
      expect(stringToBoolean('Y')).toBe(true);
    });
  });

  describe('falsy values', () => {
    it('should return false for "false"', () => {
      expect(stringToBoolean('false')).toBe(false);
    });

    it('should return false for "False" (case-insensitive)', () => {
      expect(stringToBoolean('False')).toBe(false);
    });

    it('should return false for "FALSE" (case-insensitive)', () => {
      expect(stringToBoolean('FALSE')).toBe(false);
    });

    it('should return false for "f"', () => {
      expect(stringToBoolean('f')).toBe(false);
    });

    it('should return false for "F" (case-insensitive)', () => {
      expect(stringToBoolean('F')).toBe(false);
    });

    it('should return false for "no"', () => {
      expect(stringToBoolean('no')).toBe(false);
    });

    it('should return false for "NO" (case-insensitive)', () => {
      expect(stringToBoolean('NO')).toBe(false);
    });

    it('should return false for "n"', () => {
      expect(stringToBoolean('n')).toBe(false);
    });

    it('should return false for "N" (case-insensitive)', () => {
      expect(stringToBoolean('N')).toBe(false);
    });
  });

  describe('unrecognized values', () => {
    it('should return undefined for unrecognized string', () => {
      expect(stringToBoolean('maybe')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(stringToBoolean('')).toBeUndefined();
    });

    it('should return undefined for null', () => {
      expect(stringToBoolean(null)).toBeUndefined();
    });

    it('should return undefined for undefined', () => {
      expect(stringToBoolean(undefined)).toBeUndefined();
    });

    it('should return undefined for numeric string', () => {
      expect(stringToBoolean('1')).toBeUndefined();
    });
  });

  describe('with default value', () => {
    it('should return true for recognized truthy value with default false', () => {
      expect(stringToBoolean('yes', false)).toBe(true);
    });

    it('should return false for recognized falsy value with default true', () => {
      expect(stringToBoolean('no', true)).toBe(false);
    });

    it('should return default value for unrecognized string', () => {
      expect(stringToBoolean('maybe', true)).toBe(true);
      expect(stringToBoolean('maybe', false)).toBe(false);
    });

    it('should return default value for empty string', () => {
      expect(stringToBoolean('', true)).toBe(true);
      expect(stringToBoolean('', false)).toBe(false);
    });

    it('should return default value for null', () => {
      expect(stringToBoolean(null, true)).toBe(true);
      expect(stringToBoolean(null, false)).toBe(false);
    });

    it('should return default value for undefined', () => {
      expect(stringToBoolean(undefined, true)).toBe(true);
      expect(stringToBoolean(undefined, false)).toBe(false);
    });
  });
});
