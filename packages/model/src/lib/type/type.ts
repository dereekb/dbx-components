import { filterNullAndUndefinedValues, type Maybe, mergeObjects } from '@dereekb/util';
import { type, type Type } from 'arktype';

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
 * An update to an object's values where every key is optional and {@link Clearable}.
 *
 * A `null` value clears the key, and an `undefined` value leaves it unchanged. Apply it with {@link mergeClearableObjectUpdate}.
 */
export type ClearableObjectUpdate<T extends object> = { readonly [K in keyof T]?: Clearable<T[K]> };

/**
 * Merges a {@link ClearableObjectUpdate} into the current object and returns the result as a new object.
 *
 * A `null` value in the update deletes the key, and an `undefined` value leaves the current value unchanged.
 * `null` and `undefined` values already on the current object are dropped too, so the result only holds set values.
 *
 * @param current - The current object. Null/undefined is treated as an empty object.
 * @param update - The update to merge in. Null/undefined returns a copy of the current values.
 * @returns A new object with the update applied. Neither input is modified.
 *
 * @dbxUtil
 * @dbxUtilCategory object
 * @dbxUtilTags object, merge, update, patch, clear, clearable, null, delete
 * @dbxUtilRelated merge-objects, strip-object
 *
 * @example
 * ```ts
 * mergeClearableObjectUpdate({ a: 1, b: 2 }, { b: null, c: 3, d: undefined });
 * // { a: 1, c: 3 }
 * ```
 */
export function mergeClearableObjectUpdate<T extends object>(current: Maybe<Partial<T>>, update: Maybe<ClearableObjectUpdate<T>>): Partial<T> {
  return filterNullAndUndefinedValues(mergeObjects<T>([current, update as Maybe<Partial<T>>]));
}

/**
 * Singleton ArkType schema that accepts any empty object (`{}`).
 *
 * Used as the canonical "no params" type for model API actions that require an ArkType schema but have no meaningful input fields.
 *
 * @example
 * ```typescript
 * export const doSomethingParamsType = emptyType<DoSomethingParams>();
 * ```
 */
export const EMPTY_ARKTYPE_TYPE: Type<{}> = type({});

/**
 * Returns the shared {@link EMPTY_ARKTYPE_TYPE} cast to the requested type, providing a typed empty-object schema
 * without creating a new ArkType instance each time.
 *
 * @returns The singleton empty type schema typed as `Type<T>`
 *
 * @example
 * ```typescript
 * export interface ResyncAllParams {}  // has no params currently
 * export const resyncAllParamsType = emptyType<ResyncAllParams>();
 * ```
 */
export function emptyType<T = {}>(): Type<T> {
  return EMPTY_ARKTYPE_TYPE as Type<T>;
}

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
export function clearable<const def extends string>(definition: def): Type<Maybe<type.infer<def>>>;
export function clearable<T>(definition: Type<T>): Type<Maybe<T>>;
export function clearable(definition: string | Type): any {
  let result: any;

  if (typeof definition === 'string') {
    result = `${definition} | null | undefined`;
  } else {
    result = definition.or('null').or('undefined');
  }

  return result;
}
