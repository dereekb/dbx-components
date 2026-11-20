import { isDefaultReadableError, DEFAULT_READABLE_ERROR_CODE, readErrorMessage, errorClassNames, messageFromError, errorMessageContainsString } from './error';

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

describe('readErrorMessage()', () => {
  it('should return the message of an Error', () => {
    expect(readErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('should return the message of a DOMException', () => {
    expect(readErrorMessage(new DOMException('timed out', 'TimeoutError'))).toBe('timed out');
  });

  it('should return a string message from a plain object', () => {
    expect(readErrorMessage({ message: 'x' })).toBe('x');
  });

  it('should stringify an object whose message is not a string', () => {
    expect(readErrorMessage({ message: 42 })).toBe('[object Object]');
  });

  it('should stringify primitives', () => {
    expect(readErrorMessage('plain')).toBe('plain');
    expect(readErrorMessage(42)).toBe('42');
    expect(readErrorMessage(null)).toBe('null');
    expect(readErrorMessage(undefined)).toBe('undefined');
    expect(readErrorMessage(Symbol('s'))).toBe('Symbol(s)');
  });

  it('should not throw for a null-prototype object', () => {
    expect(readErrorMessage(Object.create(null))).toBe('[object Object]');
  });

  it('should not throw for an object whose toString throws', () => {
    const value = {
      toString(): string {
        throw new Error('no');
      }
    };

    expect(readErrorMessage(value)).toBe('[object Object]');
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

describe('messageFromError()', () => {
  it('should return null for null', () => {
    expect(messageFromError(null)).toBeNull();
  });

  it('should return undefined for undefined', () => {
    expect(messageFromError(undefined)).toBeUndefined();
  });

  it('should return the string for a string', () => {
    expect(messageFromError('test message')).toBe('test message');
  });

  it('should return the message of an Error', () => {
    expect(messageFromError(new Error('error message'))).toBe('error message');
  });

  it('should return the message of a readable error', () => {
    expect(messageFromError({ code: 'TEST', message: 'readable message' })).toBe('readable message');
  });

  it('should return undefined for an object without a message', () => {
    expect(messageFromError({ code: 'TEST' })).toBeUndefined();
  });
});

describe('errorMessageContainsString()', () => {
  it('should return false for null', () => {
    expect(errorMessageContainsString(null, 'test')).toBe(false);
  });

  it('should return true when the error message contains the target', () => {
    expect(errorMessageContainsString(new Error('a test message'), 'test')).toBe(true);
  });

  it('should return false for an object without a message', () => {
    expect(errorMessageContainsString({ code: 'TEST' }, 'object')).toBe(false);
  });
});
