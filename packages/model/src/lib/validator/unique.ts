import { type ReadKeyFunction, isUniqueKeyedFunction } from '@dereekb/util';
import { type } from 'arktype';

/**
 * Creates an ArkType schema that validates an array has no duplicate keys.
 *
 * @param readKey - function that extracts the key from each array element
 * @returns an ArkType schema that narrows `T[]` to ensure uniqueness
 *
 * @example
 * ```typescript
 * const uniqueItemsType = uniqueKeyedType((item: Item) => item.id);
 * ```
 */
export function uniqueKeyedType<T>(readKey: ReadKeyFunction<T>) {
  const isUniqueKeyed = isUniqueKeyedFunction(readKey);
  return type('unknown[]').narrow((val, ctx) => isUniqueKeyed(val as T[]) || ctx.mustBe('an array with unique keys'));
}
