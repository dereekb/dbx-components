import { type Type } from 'arktype';

/**
 * Creates an ArkType schema that accepts the given type OR null.
 * Used for fields where null acts as a "clear/reset" signal.
 *
 * @example
 * ```typescript
 * const schema = type({
 *   "sdat?": clearable(type("string.date.parse")),  // string → Date | null
 * });
 * ```
 */
export function clearable<t>(schema: Type<t>) {
  return schema.or('null');
}
