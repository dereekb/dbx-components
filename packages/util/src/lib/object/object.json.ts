import { type Maybe } from '../value/maybe.type';

/**
 * A primitive value that survives a JSON round trip unchanged.
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * A JSON object whose values are all {@link JsonValue}s.
 */
export interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

/**
 * Any value that survives a JSON round trip (`JSON.parse(JSON.stringify(value))`) unchanged.
 */
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;

/**
 * Types that never survive a JSON round trip. {@link JsonCompatible} maps them to `never`.
 */
export type JsonIncompatibleType = Date | RegExp | Map<unknown, unknown> | Set<unknown> | WeakMap<object, unknown> | WeakSet<object> | Promise<unknown> | ((...args: never[]) => unknown) | bigint | symbol;

/**
 * Maps T to the closest type that survives a JSON round trip.
 *
 * Properties that hold a {@link JsonIncompatibleType} (a `Date`, a function, a `Map`, etc.) are mapped to `never`, so a value of type T only
 * satisfies `JsonCompatible<T>` when every property is JSON-compatible. Use it as an F-bounded constraint (`T extends JsonCompatible<T>`) or as an
 * intersection on a parameter (`value: T & JsonCompatible<T>`).
 *
 * `unknown`/`any` map to {@link JsonValue}.
 *
 * Class instances can't be told apart from plain objects at compile time. {@link findNonJsonCompatibleValue} is the authoritative runtime check.
 *
 * @dbxUtil
 * @dbxUtilCategory object
 * @dbxUtilTags json, serializable, compatible, type, round-trip
 * @dbxUtilRelated find-non-json-compatible-value, is-json-compatible-value
 */
export type JsonCompatible<T> = unknown extends T ? JsonValue : T extends JsonPrimitive | undefined ? T : T extends JsonIncompatibleType ? never : T extends readonly unknown[] ? { [K in keyof T]: JsonCompatible<T[K]> } : T extends object ? { [K in keyof T]: JsonCompatible<T[K]> } : never;

/**
 * Reason a value fails a JSON round trip.
 */
export type JsonIncompatibilityReason = 'function' | 'symbol' | 'bigint' | 'non_finite_number' | 'undefined_in_array' | 'date' | 'regexp' | 'map' | 'set' | 'class_instance' | 'circular';

/**
 * The first value found that fails a JSON round trip, and where it was found.
 */
export interface JsonIncompatibility {
  /**
   * Path to the offending value, e.g. `a.b[2].c`. Empty for the root value.
   */
  readonly path: string;
  readonly reason: JsonIncompatibilityReason;
}

function jsonPathWithKey(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function jsonIncompatibilityReasonForObject(value: object): Maybe<JsonIncompatibilityReason> {
  let reason: Maybe<JsonIncompatibilityReason>;

  if (value instanceof Date) {
    reason = 'date';
  } else if (value instanceof RegExp) {
    reason = 'regexp';
  } else if (value instanceof Map || value instanceof WeakMap) {
    reason = 'map';
  } else if (value instanceof Set || value instanceof WeakSet) {
    reason = 'set';
  } else if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);

    if (prototype !== Object.prototype && prototype !== null) {
      reason = 'class_instance';
    }
  }

  return reason;
}

function findNonJsonCompatibleValueAtPath(value: unknown, path: string, ancestors: Set<object>): Maybe<JsonIncompatibility> {
  let result: Maybe<JsonIncompatibility>;

  switch (typeof value) {
    case 'function':
      result = { path, reason: 'function' };
      break;
    case 'symbol':
      result = { path, reason: 'symbol' };
      break;
    case 'bigint':
      result = { path, reason: 'bigint' };
      break;
    case 'number':
      if (!Number.isFinite(value)) {
        result = { path, reason: 'non_finite_number' };
      }
      break;
    case 'object':
      if (value != null) {
        result = findNonJsonCompatibleValueInObject(value, path, ancestors);
      }
      break;
    default:
      // string, boolean and undefined are compatible. undefined object properties are dropped, which round-trips to an equivalent value.
      break;
  }

  return result;
}

function findNonJsonCompatibleValueInObject(value: object, path: string, ancestors: Set<object>): Maybe<JsonIncompatibility> {
  let result: Maybe<JsonIncompatibility>;
  const objectReason = jsonIncompatibilityReasonForObject(value);

  if (objectReason) {
    result = { path, reason: objectReason };
  } else if (ancestors.has(value)) {
    result = { path, reason: 'circular' };
  } else {
    ancestors.add(value);

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const itemPath = `${path}[${i}]`;
        const item: unknown = value[i];
        result = item === undefined ? { path: itemPath, reason: 'undefined_in_array' } : findNonJsonCompatibleValueAtPath(item, itemPath, ancestors);

        if (result) {
          break;
        }
      }
    } else {
      for (const key of Object.keys(value)) {
        result = findNonJsonCompatibleValueAtPath((value as Record<string, unknown>)[key], jsonPathWithKey(path, key), ancestors);

        if (result) {
          break;
        }
      }
    }

    ancestors.delete(value);
  }

  return result;
}

/**
 * Finds the first value inside the input that would not survive a JSON round trip (`JSON.parse(JSON.stringify(value))`) unchanged.
 *
 * Rejects functions, symbols, bigints, `NaN`/`Infinity`, `Date`/`RegExp`/`Map`/`Set` values, class instances, `undefined` array items and circular references.
 * `undefined` object properties are allowed, since they are dropped and the round-tripped value is equivalent.
 *
 * @param value - The value to check.
 * @returns The first incompatibility with its path, or undefined when the value is JSON-compatible.
 *
 * @dbxUtil
 * @dbxUtilCategory object
 * @dbxUtilTags json, serializable, compatible, check, validate, round-trip, path
 * @dbxUtilRelated is-json-compatible-value
 *
 * @example
 * ```ts
 * findNonJsonCompatibleValue({ a: [1, { b: new Date() }] });
 * // { path: 'a[1].b', reason: 'date' }
 * ```
 */
export function findNonJsonCompatibleValue(value: unknown): Maybe<JsonIncompatibility> {
  return findNonJsonCompatibleValueAtPath(value, '', new Set());
}

/**
 * Whether or not the value survives a JSON round trip unchanged. See {@link findNonJsonCompatibleValue}.
 *
 * @param value - The value to check.
 * @returns True when the value is JSON-compatible.
 *
 * @dbxUtil
 * @dbxUtilCategory object
 * @dbxUtilTags json, serializable, compatible, check, is, round-trip
 * @dbxUtilRelated find-non-json-compatible-value
 */
export function isJsonCompatibleValue<T>(value: T): value is T & JsonCompatible<T> {
  return findNonJsonCompatibleValue(value) == null;
}

/**
 * Returns a human-readable message for a {@link JsonIncompatibility}.
 *
 * @param incompatibility - The incompatibility to describe.
 * @returns A message such as `"a[1].b" is a Date, which is not JSON-compatible.`
 */
export function jsonIncompatibilityMessage(incompatibility: JsonIncompatibility): string {
  const descriptions: Record<JsonIncompatibilityReason, string> = {
    function: 'a function',
    symbol: 'a symbol',
    bigint: 'a bigint',
    non_finite_number: 'a non-finite number (NaN or Infinity)',
    undefined_in_array: 'an undefined array item',
    date: 'a Date',
    regexp: 'a RegExp',
    map: 'a Map',
    set: 'a Set',
    class_instance: 'a class instance',
    circular: 'a circular reference'
  };

  const where = incompatibility.path ? `"${incompatibility.path}"` : 'The value';
  return `${where} is ${descriptions[incompatibility.reason]}, which is not JSON-compatible.`;
}
