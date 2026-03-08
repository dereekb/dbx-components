import { type, type Type } from 'arktype';

/**
 * Creates an ArkType schema that accepts the given ArkType definition OR null.
 * Used for fields where null acts as a "clear/reset" signal for the model.
 *
 * The dbx-components library uses null in API calls to signal that something can be deleted entirely,
 * whereas undefined is simply treated as an ignore.
 *
 * @example
 * ```typescript
 * const schema = type({
 *   "sdat?": clearable("string.date.parse"),  // string → Date | null
 * });
 * ```
 */
export function clearable<const def extends string>(definition: def): Type<type.infer<def> | null | undefined> {
  return `${definition} | null | undefined` as any;
}
