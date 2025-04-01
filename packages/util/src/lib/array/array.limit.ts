import { takeFront, takeLast } from '../array/array';
import { type Maybe } from '../value/maybe.type';

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
