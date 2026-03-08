import { AssertMin, AssertMax } from './assertion.number';
import { AssertionError } from './assert.error';

describe('AssertMin', () => {
  it('should allow setting a value equal to the minimum', () => {
    const minFive = AssertMin(5);

    let storedValue = 0;
    const descriptor: TypedPropertyDescriptor<number> = {
      set(value: number) {
        storedValue = value;
      }
    };

    minFive({}, 'count', descriptor);
    descriptor.set!(5);

    expect(storedValue).toBe(5);
  });

  it('should allow setting a value greater than the minimum', () => {
    const minFive = AssertMin(5);

    let storedValue = 0;
    const descriptor: TypedPropertyDescriptor<number> = {
      set(value: number) {
        storedValue = value;
      }
    };

    minFive({}, 'count', descriptor);
    descriptor.set!(10);

    expect(storedValue).toBe(10);
  });

  it('should throw AssertionError when value is less than the minimum', () => {
    const minFive = AssertMin(5);

    const descriptor: TypedPropertyDescriptor<number> = {
      set(_value: number) {
        // noop
      }
    };

    minFive({}, 'count', descriptor);

    expect(() => descriptor.set!(3)).toThrow(AssertionError);
  });

  it('should use custom message when provided', () => {
    const minFive = AssertMin(5, { message: 'Too small!' });

    const descriptor: TypedPropertyDescriptor<number> = {
      set(_value: number) {
        // noop
      }
    };

    minFive({}, 'count', descriptor);

    expect(() => descriptor.set!(3)).toThrow('Too small!');
  });
});

describe('AssertMax', () => {
  it('should allow setting a value equal to the maximum', () => {
    const maxTen = AssertMax(10);

    let storedValue = 0;
    const descriptor: TypedPropertyDescriptor<number> = {
      set(value: number) {
        storedValue = value;
      }
    };

    maxTen({}, 'count', descriptor);
    descriptor.set!(10);

    expect(storedValue).toBe(10);
  });

  it('should allow setting a value less than the maximum', () => {
    const maxTen = AssertMax(10);

    let storedValue = 0;
    const descriptor: TypedPropertyDescriptor<number> = {
      set(value: number) {
        storedValue = value;
      }
    };

    maxTen({}, 'count', descriptor);
    descriptor.set!(5);

    expect(storedValue).toBe(5);
  });

  it('should throw AssertionError when value is greater than the maximum', () => {
    const maxTen = AssertMax(10);

    const descriptor: TypedPropertyDescriptor<number> = {
      set(_value: number) {
        // noop
      }
    };

    maxTen({}, 'count', descriptor);

    expect(() => descriptor.set!(15)).toThrow(AssertionError);
  });

  it('should use custom message when provided', () => {
    const maxTen = AssertMax(10, { message: 'Too large!' });

    const descriptor: TypedPropertyDescriptor<number> = {
      set(_value: number) {
        // noop
      }
    };

    maxTen({}, 'count', descriptor);

    expect(() => descriptor.set!(15)).toThrow('Too large!');
  });
});
