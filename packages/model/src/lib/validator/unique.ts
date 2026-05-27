import { type ReadKeyFunction, isUniqueKeyedFunction } from '@dereekb/util';
import { type } from 'arktype';

/**
 * Creates an ArkType schema that validates an array has no duplicate keys.
 *
 * @param readKey - Function that extracts the key from each array element.
 * @returns An ArkType schema that narrows `T[]` to ensure uniqueness.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind factory
 * @dbxUtilTags validator, arktype, array, unique, uniqueness, keyed
 *
 * @example
 * ```typescript
 * const uniqueItemsType = uniqueKeyedType((item: Item) => item.id);
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function uniqueKeyedType<T>(readKey: ReadKeyFunction<T>) {
  const isUniqueKeyed = isUniqueKeyedFunction(readKey);
  return type('unknown[]').narrow((val, ctx) => (val != null && isUniqueKeyed(val as T[])) || ctx.mustBe('an array with unique keys'));
}
