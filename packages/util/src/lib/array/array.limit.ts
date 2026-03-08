import { takeFront, takeLast } from '../array/array';
import { type Maybe } from '../value/maybe.type';

/**
 * Configuration for limiting the number of items returned from an array.
 */
export interface LimitArrayConfig {
  /**
   * Number of items in the list to limit in the result.
   */
  readonly limit: number;
  /**
   * If true the limit will be pulled from the end instead of the front of the array.
   */
  readonly limitFromEnd?: boolean;
}

/**
 * Limits the number of items in an array based on the provided configuration.
 * Items are taken from the front of the array by default, or from the end if configured.
 *
 * @param array - source array to limit
 * @param inputConfig - configuration controlling the limit count and direction
 * @returns a new array with at most the configured number of items, or the original array if no limit is specified
 */
export function limitArray<T>(array: T[], { limit, limitFromEnd }: Partial<LimitArrayConfig>): T[];
export function limitArray<T>(array: Maybe<T[]>, { limit, limitFromEnd }: Partial<LimitArrayConfig>): Maybe<T[]>;
export function limitArray<T>(array: Maybe<T[]>, config: Maybe<Partial<LimitArrayConfig>>): Maybe<T[]>;
export function limitArray<T>(array: Maybe<T[]>, inputConfig: Maybe<Partial<LimitArrayConfig>>): Maybe<T[]> {
  if (array && inputConfig?.limit != null) {
    const { limit, limitFromEnd } = inputConfig;

    if (limitFromEnd) {
      return takeLast(array, limit);
    } else {
      return takeFront(array, limit);
    }
  } else {
    return array;
  }
}
