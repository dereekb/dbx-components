import { getValueFromGetter, type GetterOrValueWithInput, makeWithFactory, makeWithFactoryInput, isGetter, asGetter, asObjectCopyFactory, makeGetter, objectCopyFactory, protectedFactory } from './getter';

class TestClass {}

const TEST_FUNCTION_VALUE = 'test';

function testFunction() {
  return TEST_FUNCTION_VALUE;
}

describe('getValueFromGetter()', () => {
  describe('GetterOrValueWithInput', () => {
    it('should return the value', () => {
      const x: GetterOrValueWithInput<number, number> = 0;
      const result = getValueFromGetter(x);
      expect(result).toBe(x);
    });

    it('should return the value from a getter', () => {
      const value = 10;
      const x: GetterOrValueWithInput<number, number> = () => value;
      const result = getValueFromGetter(x);
      expect(result).toBe(value);
    });

    it('should return the value from a known function', () => {
      const result = getValueFromGetter(testFunction);
      expect(result).toBe(TEST_FUNCTION_VALUE);
    });

    it('should return the value from a getter with arguments', () => {
      const getter: GetterOrValueWithInput<number, number> = (v?: number) => v ?? 0;
      const value = 10;
      const result = getValueFromGetter(getter, value);
      expect(result).toBe(value);
    });

    it('should return the class/constructor type as a value.', () => {
      const result = getValueFromGetter(TestClass);
      expect(result).toBe(TestClass);
    });
  });
});

describe('asGetter()', () => {
  it('should return a named function as itself.', () => {
    const fn = testFunction;
    const result = asGetter(fn);
    expect(result).toBe(fn);
  });

  it('should return a function as itself.', () => {
    const fn = () => 1;
    const result = asGetter(fn);
    expect(result).toBe(fn);
  });

  it('should return a Type as Getter for itself', () => {
    const result = asGetter(TestClass);
    expect(result).not.toBe(TestClass);
    expect(result()).toBe(TestClass);
  });

  it('should return a Date as Getter for itself', () => {
    const value = new Date();
    const result = asGetter(value);
    expect(result).not.toBe(value);
    expect(result()).toBe(value);
  });
});

describe('isGetter()', () => {
  it('should return true for a function', () => {
    expect(isGetter(() => 'test')).toBe(true);
    expect(isGetter(testFunction)).toBe(true);
  });

  it('should return false for non-function values', () => {
    expect(isGetter('test')).toBe(false);
    expect(isGetter(123)).toBe(false);
    expect(isGetter({})).toBe(false);
    expect(isGetter([])).toBe(false);
    expect(isGetter(null)).toBe(false);
    expect(isGetter(undefined)).toBe(false);
    expect(isGetter(TestClass)).toBe(false); // Class constructors are not considered simple getters by isNonClassFunction
  });
});

describe('makeWithFactory()', () => {
  it('should make the specified number of items using the factory.', () => {
    const factory = () => true;

    const count = 100;
    const results = makeWithFactory(factory, count);
    expect(results.length).toBe(count);
  });
});

describe('makeWithFactoryInput()', () => {
  it('should make an item for each input .', () => {
    const factoryWithInput = (input?: string) => true;

    const values = ['a', 'b', 'c', undefined, 'd'];
    const results = makeWithFactoryInput(factoryWithInput, values);
    expect(results.length).toBe(values.length);
  });
  it('should make an item for each input .', () => {
    const factoryWithRequiredInput = (input: string) => true;

    const values = ['a', 'b', 'c', 'd'];
    const results = makeWithFactoryInput(factoryWithRequiredInput, values);
    expect(results.length).toBe(values.length);
  });
});

describe('objectCopyFactory()', () => {
  it('should return a new copy of the object each time', () => {
    const original = { a: 1, b: 'test' };
    const factory = objectCopyFactory(original);
    const copy1 = factory();
    const copy2 = factory();

    expect(copy1).toEqual(original);
    expect(copy2).toEqual(original);
    expect(copy1).not.toBe(original);
    expect(copy2).not.toBe(original);
    expect(copy1).not.toBe(copy2);
  });

  it('should use the provided copyFunction', () => {
    const original = { a: 1 };
    const customCopyFunction = jest.fn((obj) => ({ ...obj, copied: true }));
    const factory = objectCopyFactory(original, customCopyFunction);
    const copy = factory();

    expect(customCopyFunction).toHaveBeenCalledWith(original);
    expect(copy.copied).toBe(true);
  });
});

describe('asObjectCopyFactory()', () => {
  it('should return an objectCopyFactory for a direct object value', () => {
    const original = { a: 1 };
    const factory = asObjectCopyFactory(original);
    const copy = factory();

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
  });

  it('should pass through an existing ObjectCopyFactory (getter function)', () => {
    const originalFactory = () => ({ a: 1 });
    const factory = asObjectCopyFactory(originalFactory);
    expect(factory).toBe(originalFactory);
  });

  it('should use the provided copyFunction when creating a new factory', () => {
    const original = { a: 1 };
    const customCopyFunction = jest.fn((obj) => ({ ...obj, copied: true }));
    const factory = asObjectCopyFactory(original, customCopyFunction);
    const copy = factory();

    expect(customCopyFunction).toHaveBeenCalledWith(original);
    expect(copy.copied).toBe(true);
  });
});

describe('makeGetter()', () => {
  it('should return a function that returns the input value', () => {
    const value = 'hello';
    const getter = makeGetter(value);
    expect(getter()).toBe(value);
  });

  it('should return a new getter function each time', () => {
    const value = { a: 1 };
    const getter1 = makeGetter(value);
    const getter2 = makeGetter(value);
    expect(getter1).not.toBe(getter2);
    expect(getter1()).toBe(value);
    expect(getter2()).toBe(value);
  });

  it('should work with different types of values', () => {
    const num = 123;
    const obj = { test: 'case' };
    const fn = () => 'function';

    expect(makeGetter(num)()).toBe(num);
    expect(makeGetter(obj)()).toBe(obj);
    expect(makeGetter(fn)()).toBe(fn);
  });
});

describe('protectedFactory()', () => {
  it('should return a factory that calls the original factory without arguments', () => {
    const originalValue = 'original factory result';
    const originalFactory = jest.fn(() => originalValue);
    const protFactory = protectedFactory(originalFactory);

    // Call the protected factory with an argument, which should be ignored
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (protFactory as any)('some ignored argument');

    expect(originalFactory).toHaveBeenCalledTimes(1);
    expect(originalFactory).toHaveBeenCalledWith(); // Called with no arguments
    expect(result).toBe(originalValue);
  });

  it('should return a new factory function', () => {
    const originalFactory = () => 'test';
    const protFactory = protectedFactory(originalFactory);
    expect(protFactory).not.toBe(originalFactory);
  });
});
