import { randomPickFactory, randomArrayIndex, pickOneRandomly } from './array.random';

describe('randomPickFactory()', () => {
  it('should create a factory that returns values from the input array', () => {
    const values = [1, 2, 3, 4, 5];
    const factory = randomPickFactory(values);

    const result = factory();

    expect(values).toContain(result);
  });

  it('should throw error when given an empty array', () => {
    expect(() => randomPickFactory([])).toThrow('randomPickFactory() cannot use an empty array.');
  });

  it('should expose _values property', () => {
    const values = ['a', 'b', 'c'];
    const factory = randomPickFactory(values);

    expect(factory._values).toBe(values);
  });
});

describe('randomArrayIndex()', () => {
  it('should return 0 for an empty array', () => {
    const result = randomArrayIndex([]);

    expect(result).toBe(0);
  });

  it('should return a valid index within array bounds', () => {
    const values = [10, 20, 30, 40, 50];

    for (let i = 0; i < 20; i++) {
      const result = randomArrayIndex(values);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(values.length);
    }
  });
});

describe('pickOneRandomly()', () => {
  it('should pick one item from the array', () => {
    const values = ['x', 'y', 'z'];

    const result = pickOneRandomly(values);

    expect(values).toContain(result);
  });

  it('should throw when given an empty array', () => {
    expect(() => pickOneRandomly([])).toThrow('randomPickFactory() cannot use an empty array.');
  });
});
