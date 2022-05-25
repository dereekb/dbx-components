import { DescriptorAssertionOptions } from "./assert";
import { PropertyDescriptorUtility } from "./assertion";

// MARK: Numbers
export function AssertMin(min: number, options?: DescriptorAssertionOptions) {
  const DEFAULT_OPTIONS = { message: 'Value was less than the minimum "' + min + '".' };
  return PropertyDescriptorUtility.makePropertyDescriptorAssertion<number>((value: number) => {
    return value >= min;
  }, options, DEFAULT_OPTIONS);
}

export function AssertMax(max: number, options?: DescriptorAssertionOptions) {
  const DEFAULT_OPTIONS = { message: 'Value was greater than the maximum "' + max + '".' };
  return PropertyDescriptorUtility.makePropertyDescriptorAssertion<number>((value: number) => {
    return value <= max;
  }, options, DEFAULT_OPTIONS);
}
