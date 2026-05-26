import { type Maybe } from '@dereekb/util';
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

/**
 * JSON Schema export helper that compensates for arktype's lossy export of narrow predicates,
 * morphs, and `undefined`. Without this:
 *
 *   - narrowed strings like `type('string > 0').narrow(...)` export as the empty schema `{}`
 *     because arktype drops the narrow predicate and has no JSON-shaped base to fall back on.
 *   - {@link clearable} (a `T | null | undefined` union) exports as `anyOf: [<T>, {}, {type:"null"}]`
 *     because `undefined` has no JSON Schema equivalent.
 *
 * The fallback config:
 *   - `predicate` / `morph` — drop the lossy wrapper, keep the JSON-shaped base (e.g. a narrowed
 *     `string > 0` becomes `{type:"string", minLength:1}`).
 *   - `default` — emit `false` (matches nothing). This is a no-op inside `anyOf`, and
 *     {@link pruneFalseUnionBranches} strips it so `T | null | undefined` reads as `T | null`.
 *
 * The result is round-tripped through `JSON.parse(JSON.stringify(...))` to invoke arktype's
 * boxed-node `toJSON()` callbacks before pruning; `structuredClone` would not call them.
 *
 * @param t - The arktype Type to export.
 * @returns The pruned JSON Schema fragment as a plain object.
 */
export function arktypeToJsonSchemaForExport(t: Type<unknown>): unknown {
  const raw = t.toJsonSchema({
    fallback: {
      predicate: (ctx) => ctx.base,
      morph: (ctx) => ctx.base,
      // `false` is a valid JSON Schema value ("matches nothing"), but arktype's TS types
      // reject `false` as the fallback return — cast through `unknown` to keep runtime behavior.
      default: (() => false) as unknown as (ctx: unknown) => never
    }
  });
  // structuredClone would skip arktype's boxed-node toJSON() callbacks, so JSON round-trip is required here.
  return pruneFalseUnionBranches(JSON.parse(JSON.stringify(raw))); // NOSONAR typescript:S7784
}

/**
 * Walks a JSON Schema and removes `false` entries from `anyOf` / `oneOf` arrays. `false`
 * schemas match nothing, so dropping them does not change what the schema accepts — it
 * just keeps the rendered output clean when {@link arktypeToJsonSchemaForExport}'s
 * `() => false` fallback emitted no-op branches for unjsonifiable types like `undefined`.
 *
 * @param value - JSON Schema fragment to clean.
 * @returns A structurally equivalent fragment with `false` branches dropped from any
 *   `anyOf` / `oneOf` arrays.
 */
export function pruneFalseUnionBranches(value: unknown): unknown {
  let result: unknown = value;

  if (Array.isArray(value)) {
    result = value.map(pruneFalseUnionBranches);
  } else if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if ((key === 'anyOf' || key === 'oneOf') && Array.isArray(raw)) {
        const filtered = raw.filter((v) => v !== false).map(pruneFalseUnionBranches);

        if (filtered.length > 0) {
          out[key] = filtered;
        }
      } else {
        out[key] = pruneFalseUnionBranches(raw);
      }
    }

    result = out;
  }

  return result;
}
