import { isDefaultReadableError, DEFAULT_READABLE_ERROR_CODE, errorMessageOf, errorClassNames } from './error';

describe('isDefaultReadableError()', () => {
  it('should return true for null/undefined', () => {
    expect(isDefaultReadableError(null)).toBe(true);
    expect(isDefaultReadableError(undefined)).toBe(true);
  });

  it('should return true for an empty string', () => {
    expect(isDefaultReadableError('')).toBe(true);
  });

  it('should return true for the default string', () => {
    expect(isDefaultReadableError(DEFAULT_READABLE_ERROR_CODE)).toBe(true);
  });

  it('should return true for an error without a code', () => {
    expect(isDefaultReadableError({ message: 'Error without a code. ' })).toBe(true);
  });

  it('should return true for an error that is the default', () => {
    expect(isDefaultReadableError({ code: DEFAULT_READABLE_ERROR_CODE })).toBe(true);
  });

  it('should return false for a non-empty string that is not the default', () => {
    expect(isDefaultReadableError('NOT_THE_DEFAULT')).toBe(false);
  });

  it('should return false for a non-empty readable error that is not the default', () => {
    expect(isDefaultReadableError({ code: 'NOT_THE_DEFAULT' })).toBe(false);
  });
});

describe('errorMessageOf()', () => {
  it('should return the message of an Error', () => {
    expect(errorMessageOf(new Error('boom'))).toBe('boom');
  });

  it('should return the message of a DOMException', () => {
    expect(errorMessageOf(new DOMException('timed out', 'TimeoutError'))).toBe('timed out');
  });

  it('should return a string message from a plain object', () => {
    expect(errorMessageOf({ message: 'x' })).toBe('x');
  });

  it('should stringify an object whose message is not a string', () => {
    expect(errorMessageOf({ message: 42 })).toBe('[object Object]');
  });

  it('should stringify primitives', () => {
    expect(errorMessageOf('plain')).toBe('plain');
    expect(errorMessageOf(42)).toBe('42');
    expect(errorMessageOf(null)).toBe('null');
    expect(errorMessageOf(undefined)).toBe('undefined');
    expect(errorMessageOf(Symbol('s'))).toBe('Symbol(s)');
  });

  it('should not throw for a null-prototype object', () => {
    expect(errorMessageOf(Object.create(null))).toBe('[object Object]');
  });

  it('should not throw for an object whose toString throws', () => {
    const value = {
      toString(): string {
        throw new Error('no');
      }
    };

    expect(errorMessageOf(value)).toBe('[object Object]');
  });
});

describe('errorClassNames()', () => {
  it('should list every class on the chain, leaf first', () => {
    class A extends Error {}
    class B extends A {}
    class C extends B {}

    expect(errorClassNames(new C())).toEqual(['C', 'B', 'A', 'Error']);
  });

  it('should start a DOMException chain with DOMException', () => {
    const names = errorClassNames(new DOMException('stop', 'AbortError'));
    expect(names[0]).toBe('DOMException');
  });

  it('should return an empty array for a non-object', () => {
    expect(errorClassNames('boom')).toEqual([]);
    expect(errorClassNames(42)).toEqual([]);
    expect(errorClassNames(null)).toEqual([]);
    expect(errorClassNames(undefined)).toEqual([]);
  });

  it('should return an empty array for a null-prototype object', () => {
    expect(errorClassNames(Object.create(null))).toEqual([]);
  });

  it('should return an empty array for a plain object', () => {
    expect(errorClassNames({ message: 'x' })).toEqual([]);
  });
});
