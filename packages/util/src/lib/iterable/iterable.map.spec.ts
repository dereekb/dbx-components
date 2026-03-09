import { mapIterable } from './iterable.map';

describe('mapIterable', () => {
  it('should map an array', () => {
    const result = mapIterable([1, 2, 3], (v) => v * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it('should map a Set', () => {
    const result = mapIterable(new Set([1, 2, 3]), (v) => v + 10);
    expect(result).toEqual([11, 12, 13]);
  });

  it('should return an empty array for an empty iterable', () => {
    const result = mapIterable([], (v) => v);
    expect(result).toEqual([]);
  });

  it('should map a Map values', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2]
    ]);
    const result = mapIterable(map, ([key, value]) => `${key}:${value}`);
    expect(result).toEqual(['a:1', 'b:2']);
  });
});
