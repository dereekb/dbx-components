import { hasValueOrNotEmpty, hasValueOrNotEmptyObject } from './maybe';

describe('hasValueOrNotEmpty()', () => {
  it('should return false for empty values.', () => {
    expect(hasValueOrNotEmpty([])).toBe(false);
    expect(hasValueOrNotEmpty(new Set())).toBe(false);
    expect(hasValueOrNotEmpty(new Map())).toBe(false);
    expect(hasValueOrNotEmpty('')).toBe(false);
    expect(hasValueOrNotEmpty(null)).toBe(false);
    expect(hasValueOrNotEmpty(undefined)).toBe(false);
  });
  it('should return true for non-empty values.', () => {
    expect(hasValueOrNotEmpty({})).toBe(true);
    expect(hasValueOrNotEmpty(true)).toBe(true);
    expect(hasValueOrNotEmpty(false)).toBe(true);
    expect(hasValueOrNotEmpty(0)).toBe(true);
    expect(hasValueOrNotEmpty(1)).toBe(true);
    expect(hasValueOrNotEmpty([1])).toBe(true);
    expect(hasValueOrNotEmpty(new Set([1]))).toBe(true);
    expect(hasValueOrNotEmpty(new Map([[1, 1]]))).toBe(true);
    expect(hasValueOrNotEmpty('test')).toBe(true);
    expect(hasValueOrNotEmpty('a')).toBe(true);
  });
});

describe('hasValueOrNotEmptyObject()', () => {
  it('should return false for empty values.', () => {
    expect(hasValueOrNotEmptyObject([])).toBe(false);
    expect(hasValueOrNotEmptyObject(new Set())).toBe(false);
    expect(hasValueOrNotEmptyObject(new Map())).toBe(false);
    expect(hasValueOrNotEmptyObject('')).toBe(false);
    expect(hasValueOrNotEmptyObject(null)).toBe(false);
    expect(hasValueOrNotEmptyObject(undefined)).toBe(false);
    expect(hasValueOrNotEmptyObject({})).toBe(false);
  });
  it('should return true for non-empty values.', () => {
    expect(hasValueOrNotEmptyObject(true)).toBe(true);
    expect(hasValueOrNotEmptyObject(false)).toBe(true);
    expect(hasValueOrNotEmptyObject(0)).toBe(true);
    expect(hasValueOrNotEmptyObject(1)).toBe(true);
    expect(hasValueOrNotEmptyObject([1])).toBe(true);
    expect(hasValueOrNotEmptyObject(new Set([1]))).toBe(true);
    expect(hasValueOrNotEmptyObject(new Map([[1, 1]]))).toBe(true);
    expect(hasValueOrNotEmptyObject('test')).toBe(true);
    expect(hasValueOrNotEmptyObject({ a: 1 })).toBe(true);
  });
});
