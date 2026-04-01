import { type Maybe } from '@dereekb/util';
import { type type, type Type } from 'arktype';

/**
 * A value that can be set to a value of `T`, or cleared by setting to `null` or `undefined`.
 *
 * Structurally equivalent to {@link Maybe}, but semantically distinct:
 * - `Maybe<T>` — the value might not exist (absence is passive)
 * - `Clearable<T>` — `null` actively signals "clear/reset this field", while `undefined` means "leave unchanged"
 *
 * Used in API update params where `null` tells the server to delete/reset a field.
 * See {@link clearable} for the ArkType schema equivalent.
 *
 * @example
 * ```typescript
 * interface UpdateUserParams {
 *   name?: string;              // required when present
 *   phone?: Clearable<string>;  // can be set, or cleared with null
 * }
 * ```
 */
export type Clearable<T> = Maybe<T>;

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
 *
 * // For tuple expressions (e.g. intersections), resolve to a Type first:
 * const zipType = type([/^\d{5}(-\d{4})?$/, '&', `string <= 11`]);
 * const schema2 = type({
 *   "zip?": clearable(zipType),
 * });
 * ```
 *
 * @param definition The ArkType definition string or Type instance to make clearable.
 * @returns An ArkType schema that accepts the defined type, null, or undefined.
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
