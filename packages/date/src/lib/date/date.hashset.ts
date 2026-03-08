import { HashSet } from '@dereekb/util';

/**
 * A {@link HashSet} specialized for Date values, using the millisecond timestamp as the hash key.
 *
 * Provides O(1) lookup, add, and delete for Date values based on exact time equality.
 *
 * @example
 * ```ts
 * const set = new DateSet([new Date('2024-01-01'), new Date('2024-01-02')]);
 * set.has(new Date('2024-01-01')); // true (same timestamp)
 * ```
 */
export class DateSet extends HashSet<number, Date> {
  constructor(values?: Date[]) {
    super({ readKey: (date) => date.getTime() }, values);
  }
}
