
/**
 * Interface for configuring a Description Assertion
 */
export interface DescriptorAssertionOptions {
  message?: string;
}

/**
 * DescriptorAssertionOptions extension that also maps one value to another.
 */
export interface MapDescriptorAssertionOptions<T> extends DescriptorAssertionOptions {

  /**
   * Maps the value after it has been validated.
   */
  map?: (value: T) => T;

}
