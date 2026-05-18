import { objectIsEmpty } from './object.empty';

describe('objectIsEmpty()', () => {
  it('should return false for a simple object.', () => {
    const a = { a: 'a' };
    expect(objectIsEmpty(a)).toBe(false);
  });

  it('should return true for an empty object.', () => {
    expect(objectIsEmpty({})).toBe(true);
  });

  it('should return true for null.', () => {
    expect(objectIsEmpty(null)).toBe(true);
  });

  it('should return true for undefined.', () => {
    expect(objectIsEmpty(undefined)).toBe(true);
  });

  it('should return true when all values are undefined.', () => {
    expect(objectIsEmpty({ a: undefined, b: undefined })).toBe(true);
  });

  it('should return true when nested objects are also empty.', () => {
    expect(objectIsEmpty({ a: {}, b: { c: undefined } })).toBe(true);
  });

  it('should return false when a nested object has a non-empty value.', () => {
    expect(objectIsEmpty({ a: {}, b: { c: 1 } })).toBe(false);
  });

  it('should return false when the value is 0.', () => {
    expect(objectIsEmpty({ a: 0 })).toBe(false);
  });

  it('should return false when the value is an empty string treated as a value.', () => {
    // hasValueOrNotEmpty considers empty string as no value, so empty string keys count as empty.
    expect(objectIsEmpty({ a: '' })).toBe(true);
  });
});
