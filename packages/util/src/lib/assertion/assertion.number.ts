import { type DescriptorAssertionOptions } from './assert';
import { PropertyDescriptorUtility } from './assertion';

// MARK: Numbers
/**
 * Creates a property decorator that asserts the numeric value is greater than or equal to a minimum.
 *
 * @param min - The minimum allowed value (inclusive)
 * @param options - Optional assertion options including custom error message
 * @returns A property descriptor interceptor that enforces the minimum value constraint
 * @throws {@link AssertionError} when the assigned value is less than `min`
 */
export function AssertMin(min: number, options?: DescriptorAssertionOptions) {
  const DEFAULT_OPTIONS = { message: 'Value was less than the minimum "' + min + '".' };
  return PropertyDescriptorUtility.makePropertyDescriptorAssertion<number>(
    (value: number) => {
      return value >= min;
    },
    options,
    DEFAULT_OPTIONS
  );
}

/**
 * Creates a property decorator that asserts the numeric value is less than or equal to a maximum.
 *
 * @param max - The maximum allowed value (inclusive)
 * @param options - Optional assertion options including custom error message
 * @returns A property descriptor interceptor that enforces the maximum value constraint
 * @throws {@link AssertionError} when the assigned value is greater than `max`
 */
export function AssertMax(max: number, options?: DescriptorAssertionOptions) {
  const DEFAULT_OPTIONS = { message: 'Value was greater than the maximum "' + max + '".' };
  return PropertyDescriptorUtility.makePropertyDescriptorAssertion<number>(
    (value: number) => {
      return value <= max;
    },
    options,
    DEFAULT_OPTIONS
  );
}
