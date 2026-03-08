import { objectKeysEqualityComparatorFunction, objectKeyEqualityComparatorFunction } from './object.key';

interface TestItem {
  id: number;
  name: string;
}

describe('objectKeysEqualityComparatorFunction()', () => {
  const comparator = objectKeysEqualityComparatorFunction<TestItem, number>((item) => item.id);

  it('should return true for two arrays with the same keys in the same order', () => {
    const a = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' }
    ];
    const b = [
      { id: 1, name: 'x' },
      { id: 2, name: 'y' }
    ];

    expect(comparator(a, b)).toBe(true);
  });

  it('should return true for two arrays with the same keys in different order', () => {
    const a = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' }
    ];
    const b = [
      { id: 2, name: 'y' },
      { id: 1, name: 'x' }
    ];

    expect(comparator(a, b)).toBe(true);
  });

  it('should return false for arrays with different keys', () => {
    const a = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' }
    ];
    const b = [
      { id: 1, name: 'x' },
      { id: 3, name: 'z' }
    ];

    expect(comparator(a, b)).toBe(false);
  });

  it('should return false for arrays with different lengths', () => {
    const a = [{ id: 1, name: 'a' }];
    const b = [
      { id: 1, name: 'x' },
      { id: 2, name: 'y' }
    ];

    expect(comparator(a, b)).toBe(false);
  });

  it('should return true for two empty arrays', () => {
    expect(comparator([], [])).toBe(true);
  });

  it('should return true when both values are null', () => {
    expect(comparator(null, null)).toBe(true);
  });

  it('should return true when both values are undefined', () => {
    expect(comparator(undefined, undefined)).toBe(true);
  });

  it('should return false when one is null and the other is an array', () => {
    expect(comparator(null, [{ id: 1, name: 'a' }])).toBe(false);
  });
});

describe('objectKeyEqualityComparatorFunction()', () => {
  const comparator = objectKeyEqualityComparatorFunction<TestItem, number>((item) => item.id);

  it('should return true for two objects with the same key', () => {
    const a = { id: 1, name: 'a' };
    const b = { id: 1, name: 'different' };

    expect(comparator(a, b)).toBe(true);
  });

  it('should return false for two objects with different keys', () => {
    const a = { id: 1, name: 'a' };
    const b = { id: 2, name: 'b' };

    expect(comparator(a, b)).toBe(false);
  });

  it('should return true when both values are null', () => {
    expect(comparator(null, null)).toBe(true);
  });

  it('should return false when one is null and the other is defined', () => {
    expect(comparator(null, { id: 1, name: 'a' })).toBe(false);
  });
});
