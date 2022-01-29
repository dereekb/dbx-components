import { DescriptorAssertionOptions, MapDescriptorAssertionOptions } from "./assert";
import { AssertionIssue, ASSERTION_HANDLER } from "./assert.error";

// MARK: Generic Assertions
type SetAccessorFunction<T> = (value: T) => void;

/**
 * Assertion function type.
 *
 * Returns true if the assertion passes.
 */
export type AccessorValueAssertion<T> = (value: T) => boolean;

export interface SetValueInterceptorFunctionInput<T> {
  target: object;
  propertyKey: string;
  descriptor: TypedPropertyDescriptor<T>;
  setValue: (value: T) => void;
}

export type SetValueInterceptorFunctionFactory<T> = (input: SetValueInterceptorFunctionInput<T>) => ((value: T) => void);

export class PropertyDescriptorUtility {

  static makePropertyDescriptorAssertion<T>(assertValueFn: AccessorValueAssertion<T>, options?: MapDescriptorAssertionOptions<T>, defaultOptions?: MapDescriptorAssertionOptions<T>) {

    // Build options
    options = {
      ...defaultOptions,
      ...options
    };

    return this.makeSetPropertyDescriptorInterceptor<T>(({ target, propertyKey, setValue }) => {
      const map = options?.map || ((x) => x);

      return function (this: any, value: T) {
        if (assertValueFn(value)) {
          const mappedValue = map(value);
          setValue.call(this, mappedValue); // TODO: "this" may not be necessary here, if setValue is expected to always be an arrow function.
        } else {
          const error: AssertionIssue = { target, propertyKey, options };
          ASSERTION_HANDLER.handle(error);
        }
      };
    });
  }

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
