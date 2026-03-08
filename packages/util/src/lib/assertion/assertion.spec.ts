import { PropertyDescriptorUtility, type AccessorValueAssertion } from './assertion';
import { AssertionError } from './assert.error';

describe('PropertyDescriptorUtility', () => {
  describe('makePropertyDescriptorAssertion', () => {
    it('should allow setting a value that passes the assertion', () => {
      const isPositive: AccessorValueAssertion<number> = (v) => v > 0;
      const interceptor = PropertyDescriptorUtility.makePropertyDescriptorAssertion(isPositive);

      let storedValue = 0;
      const descriptor: TypedPropertyDescriptor<number> = {
        set(value: number) {
          storedValue = value;
        }
      };

      interceptor({}, 'testProp', descriptor);
      descriptor.set!(5);

      expect(storedValue).toBe(5);
    });

    it('should throw AssertionError when the assertion fails', () => {
      const isPositive: AccessorValueAssertion<number> = (v) => v > 0;
      const interceptor = PropertyDescriptorUtility.makePropertyDescriptorAssertion(isPositive);

      let storedValue = 0;
      const descriptor: TypedPropertyDescriptor<number> = {
        set(value: number) {
          storedValue = value;
        }
      };

      interceptor({}, 'testProp', descriptor);

      expect(() => descriptor.set!(-1)).toThrow(AssertionError);
      expect(storedValue).toBe(0);
    });

    it('should apply the map function to valid values', () => {
      const isPositive: AccessorValueAssertion<number> = (v) => v > 0;
      const interceptor = PropertyDescriptorUtility.makePropertyDescriptorAssertion(isPositive, {
        map: (v) => v * 2
      });

      let storedValue = 0;
      const descriptor: TypedPropertyDescriptor<number> = {
        set(value: number) {
          storedValue = value;
        }
      };

      interceptor({}, 'testProp', descriptor);
      descriptor.set!(5);

      expect(storedValue).toBe(10);
    });

    it('should use custom message from options when assertion fails', () => {
      const isPositive: AccessorValueAssertion<number> = (v) => v > 0;
      const interceptor = PropertyDescriptorUtility.makePropertyDescriptorAssertion(isPositive, {
        message: 'Must be positive'
      });

      const descriptor: TypedPropertyDescriptor<number> = {
        set(_value: number) {
          // noop
        }
      };

      interceptor({}, 'testProp', descriptor);

      expect(() => descriptor.set!(-1)).toThrow('Must be positive');
    });
  });

  describe('makeSetPropertyDescriptorInterceptor', () => {
    it('should intercept the setter with a custom function', () => {
      const calls: number[] = [];

      const interceptor = PropertyDescriptorUtility.makeSetPropertyDescriptorInterceptor<number>(({ setValue }) => {
        return function (this: unknown, value: number) {
          calls.push(value);
          setValue.call(this, value + 1);
        };
      });

      let storedValue = 0;
      const descriptor: TypedPropertyDescriptor<number> = {
        set(value: number) {
          storedValue = value;
        }
      };

      interceptor({}, 'testProp', descriptor);
      descriptor.set!(10);

      expect(calls).toEqual([10]);
      expect(storedValue).toBe(11);
    });

    it('should not modify the descriptor if there is no setter', () => {
      const interceptor = PropertyDescriptorUtility.makeSetPropertyDescriptorInterceptor<number>(() => {
        return () => {
          // noop
        };
      });

      const descriptor: TypedPropertyDescriptor<number> = {
        get() {
          return 0;
        }
      };

      interceptor({}, 'testProp', descriptor);

      expect(descriptor.set).toBeUndefined();
    });
  });
});
