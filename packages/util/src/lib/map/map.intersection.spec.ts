import { mapKeysIntersectionObjectToArray } from './map.intersection';

describe('mapKeysIntersectionObjectToArray', () => {
  it('should return values for matching keys', () => {
    const obj = { a: 'x', b: 'y', c: 'z' };
    const result = mapKeysIntersectionObjectToArray(obj, ['a', 'c']);
    expect(result).toEqual(['x', 'z']);
  });

  it('should expand array values for matching keys', () => {
    const obj = { a: [1, 2], b: [3] };
    const result = mapKeysIntersectionObjectToArray(obj, ['a']);
    expect(result).toEqual([1, 2]);
  });

  it('should return an empty array when no keys match', () => {
    const obj = { a: 1, b: 2 };
    const result = mapKeysIntersectionObjectToArray(obj, ['x', 'y']);
    expect(result).toEqual([]);
  });

  it('should skip keys with null/undefined values', () => {
    const obj: Record<string, number | null> = { a: 1, b: null };
    const result = mapKeysIntersectionObjectToArray(obj, ['a', 'b']);
    expect(result).toEqual([1]);
  });
});
