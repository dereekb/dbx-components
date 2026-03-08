import { randomArrayFactory } from './array.make';

describe('randomArrayFactory()', () => {
  it('should create an array using the make function', () => {
    const make = vi.fn((index: number) => `item-${index}`);
    const factory = randomArrayFactory({ make, random: { min: 3, max: 3 } });

    const result = factory();

    expect(result).toEqual(['item-0', 'item-1', 'item-2']);
    expect(make).toHaveBeenCalledTimes(3);
  });

  it('should use the random function to determine count when count not provided', () => {
    const randomFn = vi.fn().mockReturnValue(4);
    const make = vi.fn((index: number) => index);
    const factory = randomArrayFactory({ make, random: randomFn });

    const result = factory();

    expect(randomFn).toHaveBeenCalled();
    expect(result).toHaveLength(4);
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('should use explicit count when provided', () => {
    const randomFn = vi.fn().mockReturnValue(10);
    const make = vi.fn((index: number) => index);
    const factory = randomArrayFactory({ make, random: randomFn });

    const result = factory(2);

    expect(randomFn).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result).toEqual([0, 1]);
  });

  it('should work with RandomNumberFactoryInput config object for random', () => {
    const make = vi.fn((index: number) => `value-${index}`);
    const factory = randomArrayFactory({ make, random: { min: 2, max: 5 } });

    const result = factory();

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(make).toHaveBeenCalled();

    result.forEach((item, index) => {
      expect(item).toBe(`value-${index}`);
    });
  });
});
