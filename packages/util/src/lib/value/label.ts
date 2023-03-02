/**
 * Refernce to a label string.
 */
export interface LabelRef {
  label: string;
}

/**
 * Labeled value
 */
export interface LabeledValue<T> extends LabelRef {
  value: T;
}
