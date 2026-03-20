import { type MapDescriptorAssertionOptions } from './assert';
import { type AssertionIssue, ASSERTION_HANDLER } from './assert.error';

// MARK: Generic Assertions
type SetAccessorFunction<T> = (value: T) => void;

/**
 * Assertion function type that validates a value.
 *
 * Returns true if the assertion passes, false otherwise.
 */
export type AccessorValueAssertion<T> = (value: T) => boolean;

/**
 * Input provided to a set-value interceptor factory function.
 */
export interface SetValueInterceptorFunctionInput<T> {
  target: object;
  propertyKey: string;
  descriptor: TypedPropertyDescriptor<T>;
  setValue: (value: T) => void;
}

/**
 * Factory function that creates a setter interceptor from the provided input.
 */
export type SetValueInterceptorFunctionFactory<T> = (input: SetValueInterceptorFunctionInput<T>) => (value: T) => void;

/**
 * Utility class for creating property descriptor interceptors that validate
 * values before allowing them to be set on a property.
 *
 * Used to build TypeScript decorator functions that enforce assertions on property setters.
 */
export class PropertyDescriptorUtility {
  /**
   * Creates a property descriptor interceptor that validates values using an assertion function
   * before allowing them to be set. Optionally maps the value after validation.
   *
   * @param assertValueFn - Function that returns true if the value is valid
   * @param options - Custom assertion options (message, map function)
   * @param defaultOptions - Default options merged under the custom options
   * @returns A property descriptor interceptor function
   */
  static makePropertyDescriptorAssertion<T>(assertValueFn: AccessorValueAssertion<T>, options?: MapDescriptorAssertionOptions<T>, defaultOptions?: MapDescriptorAssertionOptions<T>) {
    // Build options
    options = {
      ...defaultOptions,
      ...options
    };

    return this.makeSetPropertyDescriptorInterceptor<T>(({ target, propertyKey, setValue }) => {
      const map = options.map ?? ((x) => x);

      return function (this: unknown, value: T) {
        if (assertValueFn(value)) {
          const mappedValue = map(value);
          setValue.call(this, mappedValue);
        } else {
          const error: AssertionIssue = { target, propertyKey, options };
          ASSERTION_HANDLER.handle(error);
        }
      };
    });
  }

  /**
   * Creates a low-level property descriptor interceptor that replaces the setter
   * of a property with a custom function produced by the given factory.
   *
   * @param makeSetValueInterceptorFn - Factory that produces the replacement setter function
   * @returns A property descriptor interceptor function
   */
  static makeSetPropertyDescriptorInterceptor<T>(makeSetValueInterceptorFn: SetValueInterceptorFunctionFactory<T>) {
    const interceptor = (target: object, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => {
      if (descriptor.set) {
        const setValue: SetAccessorFunction<T> = descriptor.set;

        // Override set function with assertion.
        descriptor.set = makeSetValueInterceptorFn({
          target,
          propertyKey,
          descriptor,
          setValue
        });
      }
    };
    return interceptor;
  }
}
