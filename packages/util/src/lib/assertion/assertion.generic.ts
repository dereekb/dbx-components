import { type MapDescriptorAssertionOptions } from './assert';
import { type AccessorValueAssertion, PropertyDescriptorUtility } from './assertion';

// MARK: Generic
/**
 * Creates a property decorator that validates values using a custom assertion function
 * before allowing them to be set on the property.
 *
 * @param assertion - Function that returns true if the value is valid
 * @param options - Optional assertion options including custom error message and value mapping
 * @returns A property descriptor interceptor that enforces the assertion on the setter
 */
export function Assert<T>(assertion: AccessorValueAssertion<T>, options?: MapDescriptorAssertionOptions<T>) {
  return PropertyDescriptorUtility.makePropertyDescriptorAssertion<T>(assertion, options);
}
