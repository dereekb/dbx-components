/**
 * A record where the keys and values are strings.
 */
export type StringRecord<K extends string, V extends string> = Record<K, V>;

/**
 * Inverts a string record, inverting the key and value of each entry in the record.
 *
 * @param record
 * @returns
 */
export function invertStringRecord<K extends string, V extends string>(record: StringRecord<K, V>): StringRecord<V, K> {
  const inverted: StringRecord<V, K> = {} as StringRecord<V, K>;

  Object.entries(record).forEach(([key, value]) => {
    inverted[value as V] = key as K;
  });

  return inverted;
}
