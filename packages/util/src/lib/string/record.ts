/**
 * A record where both keys and values are typed strings.
 *
 * @template K - The key string type.
 * @template V - The value string type.
 */
export type StringRecord<K extends string, V extends string> = Record<K, V>;

/**
 * Inverts a string record by swapping each entry's key and value.
 *
 * @param record - The record to invert.
 * @returns A new record with the original values as keys and the original keys as values.
 */
export function invertStringRecord<K extends string, V extends string>(record: StringRecord<K, V>): StringRecord<V, K> {
  const inverted: StringRecord<V, K> = {} as StringRecord<V, K>;

  Object.entries(record).forEach(([key, value]) => {
    inverted[value as V] = key as K;
  });

  return inverted;
}
