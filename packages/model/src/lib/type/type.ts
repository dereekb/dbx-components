import { type type, type Type } from 'arktype';

/**
 * Creates an ArkType schema that accepts the given ArkType definition OR null/undefined.
 * Used for fields where null acts as a "clear/reset" signal for the model.
 *
 * The dbx-components library uses null in API calls to signal that something can be deleted entirely,
 * whereas undefined is simply treated as an ignore.
 *
 * Accepts either a string definition or a Type instance.
 *
 * @example
 * ```typescript
 * const schema = type({
 *   "sdat?": clearable("string.date.parse"),          // string definition
 *   "phone?": clearable(e164PhoneNumberType),          // Type instance
 *   "items?": clearable(mySchemaType.array()),          // .array() result
 * });
 * ```
 */
export function clearable<const def extends string>(definition: def): Type<type.infer<def> | null | undefined>;
export function clearable<T>(definition: Type<T>): Type<T | null | undefined>;
export function clearable(definition: string | Type): any {
  let result: any;

  if (typeof definition === 'string') {
    result = `${definition} | null | undefined`;
  } else {
    result = definition.or('null').or('undefined');
  }

  return result;
}
