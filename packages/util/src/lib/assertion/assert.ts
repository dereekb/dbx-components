/**
 * Interface for configuring a Description Assertion.
 * Provides options for customizing assertion messages.
 * @interface
 */
export interface DescriptorAssertionOptions {
  message?: string;
}

/**
 * DescriptorAssertionOptions extension that also maps one value to another.
 * Extends the base assertion options to include a mapping function.
 * @interface
 * @template T - The type of value being mapped
 */
export interface MapDescriptorAssertionOptions<T> extends DescriptorAssertionOptions {
  /**
   * Maps the value after it has been validated.
   * This function is applied to transform the value after the assertion passes.
   * @param value - The value to transform after validation
   * @returns The transformed value
   */
  map?: (value: T) => T;
}
