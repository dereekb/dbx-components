import { asGetter } from '@dereekb/util';
import { getValueFromGetter, GetterOrValueWithInput, makeWithFactory, makeWithFactoryInput } from './getter';

class TestClass {}

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
