import { Assert } from './assertion.generic';
import { AssertionError } from './assert.error';

describe('Assert', () => {
  it('should allow setting a value that passes the assertion', () => {
    const isNonEmpty = Assert<string>((v) => v.length > 0);

    let storedValue = '';
    const descriptor: TypedPropertyDescriptor<string> = {
      set(value: string) {
        storedValue = value;
      }
    };

    isNonEmpty({}, 'name', descriptor);
    descriptor.set!('hello');

    expect(storedValue).toBe('hello');
  });

  it('should throw AssertionError when the assertion fails', () => {
    const isNonEmpty = Assert<string>((v) => v.length > 0);

    const descriptor: TypedPropertyDescriptor<string> = {
      set(_value: string) {
        // noop
      }
    };

    isNonEmpty({}, 'name', descriptor);

    expect(() => descriptor.set!('')).toThrow(AssertionError);
  });

  it('should apply the map function when the assertion passes', () => {
    const trimmed = Assert<string>((v) => v.length > 0, {
      map: (v) => v.trim()
    });

    let storedValue = '';
    const descriptor: TypedPropertyDescriptor<string> = {
      set(value: string) {
        storedValue = value;
      }
    };

    trimmed({}, 'name', descriptor);
    descriptor.set!('  hello  ');

    expect(storedValue).toBe('hello');
  });
});
