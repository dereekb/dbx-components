import { type MapDescriptorAssertionOptions } from './assert';
import { type AccessorValueAssertion, PropertyDescriptorUtility } from './assertion';

// MARK: Generic
export function Assert<T>(assertion: AccessorValueAssertion<T>, options?: MapDescriptorAssertionOptions<T>) {
  return PropertyDescriptorUtility.makePropertyDescriptorAssertion<T>(assertion, options);
}
