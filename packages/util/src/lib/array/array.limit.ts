import { takeFront, takeLast } from '../array';
import { Maybe } from '../value/maybe';

export interface LimitArrayConfig {
  /**
   * Number of items in the list to limit in the result.
   */
  limit: number;
  /**
   * If true the limit will be pulled from the end instead of the front of the array.
   */
  limitFromEnd?: boolean;
}

export function limitArray<T>(array: T[], { limit, limitFromEnd }: Partial<LimitArrayConfig>): T[];
export function limitArray<T>(array: Maybe<T[]>, { limit, limitFromEnd }: Partial<LimitArrayConfig>): Maybe<T[]>;
export function limitArray<T>(array: Maybe<T[]>, { limit, limitFromEnd }: Partial<LimitArrayConfig>): Maybe<T[]> {
  if (array && limit != null) {
    if (limitFromEnd) {
      return takeLast(array, limit);
    } else {
      return takeFront(array, limit);
    }
  } else {
    return array;
  }
}
