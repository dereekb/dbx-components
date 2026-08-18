import { type Maybe } from '../value/maybe.type';
import { isPlainObject, objectHasNoKeys, type POJOKey } from './object';
import { filterKeyValueTupleFunction, type FilterKeyValueTuplesInput, KeyValueTypleValueFilter } from './object.filter.tuple';

// MARK: Copy Value Deep
/**
 * How a {@link CopyValueDeepFunction} handles a value within an array that the filter removes.
 *
 * - `remove`: the value is left out of the copied array, shortening it.
 * - `retain`: the value is copied as-is. Effectively exempts array values from filtering.
 * - `nullify`: the value is replaced with `null`, retaining the array's length and indexes.
 */
export type CopyValueDeepArrayValuesMode = 'remove' | 'retain' | 'nullify';

/**
 * Transform applied to a value before it is filtered and copied.
 *
 * The transform's result is what gets recursed into, so returning an object/array from a primitive (or
 * vice-versa) is allowed. The key is the key/index the value was read from, and is `undefined` for the
 * root value.
 */
export type CopyValueDeepTransformFunction = (value: unknown, key: Maybe<POJOKey>) => unknown;

/**
 * Configuration for {@link copyValueDeep} and {@link copyValueDeepFunction}.
 */
export interface CopyValueDeepConfig {
  /**
   * Filter that decides which key/value pairs are retained. Applied to every object and array
   * encountered, at every depth.
   *
   * Defaults to {@link KeyValueTypleValueFilter.UNDEFINED}, which removes `undefined` values.
   */
  readonly filter?: FilterKeyValueTuplesInput<Record<string, unknown>>;
  /**
   * How a filtered value within an array is handled. Defaults to `remove`.
   */
  readonly arrayValues?: CopyValueDeepArrayValuesMode;
  /**
   * Whether an object/array that the copy leaves empty is itself filtered out of its parent.
   *
   * Defaults to `false`, so `{ a: { b: undefined } }` copies to `{ a: {} }`. When `true` it copies to
   * `{}` instead, since the nested object carries nothing once `b` is gone.
   */
  readonly filterEmptyValues?: boolean;
  /**
   * Transform applied to each value before it is filtered and copied.
   */
  readonly transform?: CopyValueDeepTransformFunction;
}

/**
 * Recursively copies a value, filtering values as it goes.
 */
export type CopyValueDeepFunction = <T>(value: T) => T;

/**
 * Creates a reusable {@link CopyValueDeepFunction}.
 *
 * Plain objects and arrays are copied recursively. Every other value is retained by reference:
 * primitives have nothing to copy, and a `Date`/`Map`/`Set`/class instance is a value in its own right,
 * not a bag of keys to rebuild — copying one key-by-key would replace a `Date` with `{}`. This is what
 * makes the function safe to use on data that carries such instances (a Firestore `Timestamp`, a
 * `DocumentReference`) alongside plain json.
 *
 * The root value itself is never filtered — only the values found within an object or array are, since
 * the filter is a decision about a key/value pair. A root `undefined` therefore copies to `undefined`.
 *
 * Repeated and cyclical references are tracked, so a value referenced twice is copied once and a cycle
 * terminates rather than overflowing the stack.
 *
 * @param config - Filter, array handling, and transform configuration. Defaults to removing `undefined` values.
 * @returns Recursively copies any input value.
 *
 * @dbxUtil
 * @dbxUtilCategory object
 * @dbxUtilKind factory
 * @dbxUtilTags object, copy, clone, deep, recursive, filter, transform, undefined, factory
 * @dbxUtilRelated copy-value-deep, filter-from-pojo-function, copy-object
 *
 * @example
 * ```ts
 * // remove undefined values at any depth
 * const copyFn = copyValueDeepFunction();
 * copyFn({ a: 1, b: undefined, c: { d: undefined, e: [1, undefined] } });
 * // { a: 1, c: { e: [1] } }
 *
 * // remove null and undefined values, and prune anything left empty
 * const copyCleanFn = copyValueDeepFunction({ filter: KeyValueTypleValueFilter.NULL, filterEmptyValues: true });
 * copyCleanFn({ a: 1, b: { c: null } });
 * // { a: 1 }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function copyValueDeepFunction(config?: Maybe<CopyValueDeepConfig>): CopyValueDeepFunction {
  const { filter = KeyValueTypleValueFilter.UNDEFINED, arrayValues = 'remove', filterEmptyValues = false, transform } = config ?? {};
  const retainKeyValue = filterKeyValueTupleFunction<Record<string, unknown>>(filter);

  /**
   * Returns true if the copied value is retained by the filter.
   *
   * @param key - The key/index the value was read from.
   * @param value - The already-copied value.
   * @param index - The index of the key/value pair within its parent.
   * @returns `true` if the value is kept.
   */
  function retainValue(key: POJOKey, value: unknown, index: number): boolean {
    let result = retainKeyValue([key as string, value], index);

    if (result && filterEmptyValues) {
      result = !isEmptyCopiedValue(value);
    }

    return result;
  }

  function copyValue(input: unknown, key: Maybe<POJOKey>, copied: Map<object, unknown>): unknown {
    const value = transform ? transform(input, key) : input;
    let result: unknown;

    if (value == null || typeof value !== 'object') {
      result = value; // nothing to copy
    } else if (copied.has(value)) {
      result = copied.get(value); // repeated or cyclical reference
    } else if (Array.isArray(value)) {
      const array: unknown[] = [];
      copied.set(value, array);

      value.forEach((inputValue, i) => {
        const copiedValue = copyValue(inputValue, i, copied);

        if (arrayValues === 'retain' || retainValue(i, copiedValue, i)) {
          array.push(copiedValue);
        } else if (arrayValues === 'nullify') {
          array.push(null);
        }
      });

      result = array;
    } else if (isPlainObject(value)) {
      const object: Record<string, unknown> = {};
      copied.set(value, object);

      Object.entries(value).forEach(([valueKey, inputValue], i) => {
        const copiedValue = copyValue(inputValue, valueKey, copied);

        if (retainValue(valueKey, copiedValue, i)) {
          object[valueKey] = copiedValue;
        }
      });

      result = object;
    } else {
      result = value; // Date/Map/Set/class instances are retained by reference
    }

    return result;
  }

  return <T>(value: T) => copyValue(value, undefined, new Map()) as T;
}

/**
 * Recursively copies a value, filtering values as it goes.
 *
 * See {@link copyValueDeepFunction} for the copy/filter semantics. Prefer the factory when copying more
 * than one value with the same configuration.
 *
 * @param value - The value to copy.
 * @param config - Filter, array handling, and transform configuration. Defaults to removing `undefined` values.
 * @returns A recursive copy of the value.
 *
 * @dbxUtil
 * @dbxUtilCategory object
 * @dbxUtilTags object, copy, clone, deep, recursive, filter, transform, undefined
 * @dbxUtilRelated copy-value-deep-function, filter-from-pojo, copy-object
 *
 * @example
 * ```ts
 * copyValueDeep({ a: 1, b: { c: undefined } });
 * // { a: 1, b: {} }
 * ```
 */
export function copyValueDeep<T>(value: T, config?: Maybe<CopyValueDeepConfig>): T {
  return copyValueDeepFunction(config)(value);
}

/**
 * Pre-built {@link CopyValueDeepFunction} that recursively copies a value, removing every `undefined`
 * value at every depth.
 *
 * This is the deep counterpart to {@link filterOnlyUndefinedValues}, and is what a consumer that rejects
 * `undefined` outright (Firestore, `JSON.stringify` in a strict schema) needs before a write.
 *
 * @example
 * ```ts
 * copyValueWithoutUndefinedValues({ a: 1, b: undefined, c: [{ d: undefined }] });
 * // { a: 1, c: [{}] }
 * ```
 */
export const copyValueWithoutUndefinedValues: CopyValueDeepFunction = copyValueDeepFunction({ filter: KeyValueTypleValueFilter.UNDEFINED });

/**
 * Pre-built {@link CopyValueDeepFunction} that recursively copies a value, removing every `null` and
 * `undefined` value at every depth.
 *
 * This is the deep counterpart to {@link filterNullAndUndefinedValues}.
 *
 * @example
 * ```ts
 * copyValueWithoutNullAndUndefinedValues({ a: 1, b: null, c: [{ d: undefined }] });
 * // { a: 1, c: [{}] }
 * ```
 */
export const copyValueWithoutNullAndUndefinedValues: CopyValueDeepFunction = copyValueDeepFunction({ filter: KeyValueTypleValueFilter.NULL });

/**
 * Returns true if the value is a copied object/array that the copy left with no values.
 *
 * Only plain objects and arrays qualify — a `Date` has no keys either, and is not empty.
 *
 * @param value - The copied value to check.
 * @returns `true` if the value is an empty plain object or array.
 */
function isEmptyCopiedValue(value: unknown): boolean {
  let result = false;

  if (Array.isArray(value)) {
    result = value.length === 0;
  } else if (isPlainObject(value)) {
    result = objectHasNoKeys(value);
  }

  return result;
}
