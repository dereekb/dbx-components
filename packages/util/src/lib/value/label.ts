import { type PrimativeKey } from '../key';

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

/**
 * Creates a new Map of LabeledValue values.
 *
 * @param values
 * @returns
 */
export function labeledValueMap<V extends LabeledValue<T>, T extends PrimativeKey>(values: V[]): Map<T, V> {
  return new Map(values.map((x) => [x.value, x]));
}
