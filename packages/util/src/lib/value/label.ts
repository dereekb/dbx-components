import { type PrimativeKey } from '../key';

/**
 * Reference to a human-readable label string.
 */
export interface LabelRef {
  label: string;
}

/**
 * Pairs a value with a human-readable label, useful for dropdown options, tags, and display lists.
 */
export interface LabeledValue<T> extends LabelRef {
  value: T;
}

/**
 * Creates a {@link Map} from an array of {@link LabeledValue} items, keyed by each item's value.
 *
 * Enables fast lookup of labeled items by their value key.
 *
 * @param values - array of labeled values to index
 * @returns a Map keyed by each item's value for fast lookup
 *
 * @example
 * ```ts
 * const items: LabeledValue<string>[] = [
 *   { value: 'a', label: 'Alpha' },
 *   { value: 'b', label: 'Beta' }
 * ];
 * const map = labeledValueMap(items);
 * map.get('a')?.label; // 'Alpha'
 * ```
 */
export function labeledValueMap<V extends LabeledValue<T>, T extends PrimativeKey>(values: V[]): Map<T, V> {
  return new Map(values.map((x) => [x.value, x]));
}

// MARK: With Description
/**
 * Pairs a value with a human-readable label and an optional description.
 */
export interface LabeledValueWithDescription<T> extends LabeledValue<T> {
  description?: string;
}
